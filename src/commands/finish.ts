import { removeWorktree } from "../git.js";
import {
  assertChangeName,
  defaultBranch,
  resolveRepoContext,
} from "../resolve.js";
import {
  isSubmoduleContainmentError,
  prepareWorktreeForRemoval,
} from "../submodules/teardown.js";
import { locateWorkspace } from "./where.js";
import {
  cleanupMergedChangeBranches,
  type BranchCleanupDeps,
  defaultBranchCleanupDeps,
} from "./branch-cleanup.js";
import { printSuccess } from "../output.js";
import { CliError, type FinishOptions, type FinishResult } from "../types.js";

export type FinishDeps = {
  locate: typeof locateWorkspace;
  resolveRepo: typeof resolveRepoContext;
  prepare: typeof prepareWorktreeForRemoval;
  removeWorktree: typeof removeWorktree;
  branchCleanup: typeof cleanupMergedChangeBranches;
  branchCleanupDeps?: BranchCleanupDeps;
};

const defaultFinishDeps: FinishDeps = {
  locate: locateWorkspace,
  resolveRepo: resolveRepoContext,
  prepare: prepareWorktreeForRemoval,
  removeWorktree,
  branchCleanup: cleanupMergedChangeBranches,
};

export function runFinish(
  options: FinishOptions,
  deps: FinishDeps = defaultFinishDeps,
): FinishResult {
  const change = assertChangeName(options.change);
  const ctx = deps.resolveRepo(options.repo);
  const branch = defaultBranch(change, options.branch);
  const remote = options.remote ?? "origin";
  const keepBranch = Boolean(options.keepBranch);
  const force = Boolean(options.force);

  let worktreeRemoved = false;
  let path: string | null = null;
  let dirty = false;
  let locatedBranch = branch;

  try {
    const loc = deps.locate(options);
    path = loc.path;
    dirty = loc.dirty;
    locatedBranch = loc.branch;

    if (dirty && !force) {
      throw new CliError(
        "worktree_dirty",
        `Worktree is dirty: ${loc.path}. Dirtiness may include uncommitted submodule changes. ` +
          `Commit/stash (submodule first, then parent gitlink) or pass --force ` +
          `(discards uncommitted work, including inside submodules).`,
        { path: loc.path, change: loc.change },
      );
    }

    deps.prepare(loc.path);

    try {
      deps.removeWorktree(ctx.cwd, loc.path, force);
    } catch (err) {
      if (err instanceof CliError) {
        const msg = err.message || "";
        if (isSubmoduleContainmentError(msg)) {
          throw new CliError(
            "submodule_teardown_failed",
            `Cannot remove worktree ${loc.path}: still contains submodules after prepare. ` +
              `Manually: cd ${loc.path} && git submodule deinit -f -- <path>, then retry finish. ${msg}`,
            { path: loc.path, change: loc.change, cause: msg },
          );
        }
        throw err;
      }
      throw err;
    }
    worktreeRemoved = true;
  } catch (err) {
    if (err instanceof CliError && err.code === "not_found") {
      // Branch-only closeout path
      path = null;
    } else {
      throw err;
    }
  }

  const cleanup = deps.branchCleanup(
    {
      change,
      cwd: ctx.primaryPath,
      branch: locatedBranch,
      remote,
      keepBranch,
    },
    deps.branchCleanupDeps ?? defaultBranchCleanupDeps,
  );

  const branchDeleted = cleanup.localDeleted;

  let action: FinishResult["action"];
  if (worktreeRemoved && (cleanup.localDeleted || cleanup.remoteDeleted)) {
    action = "removed_and_pruned";
  } else if (worktreeRemoved) {
    action = "removed";
  } else if (cleanup.localDeleted || cleanup.remoteDeleted) {
    action = "pruned_only";
  } else if (
    !worktreeRemoved &&
    cleanup.attempted &&
    cleanup.localAlreadyAbsent &&
    cleanup.remoteAlreadyAbsent
  ) {
    action = "already_clean";
  } else if (!worktreeRemoved && cleanup.keptReason === "not_merged") {
    // nothing to remove and cannot prune
    throw new CliError(
      "not_found",
      `No worktree for '${change}' and no merged PR to clean up for branch '${locatedBranch}'.`,
      { change, branch: locatedBranch },
    );
  } else if (!worktreeRemoved && cleanup.keptReason === "keep_flag") {
    throw new CliError(
      "not_found",
      `No worktree for '${change}' and --keep-branch set (nothing to do).`,
      { change, branch: locatedBranch },
    );
  } else {
    action = worktreeRemoved ? "removed" : "already_clean";
  }

  // If we had worktree removed and not_merged, action stays "removed"
  if (worktreeRemoved && cleanup.keptReason === "not_merged") {
    action = "removed";
  }

  const result: FinishResult = {
    action,
    change,
    path,
    branch: locatedBranch,
    branchDeleted,
    forced: force && dirty,
    worktreeRemoved,
    keepBranch,
    remote,
    branchCleanup: {
      attempted: cleanup.attempted,
      localDeleted: cleanup.localDeleted,
      localAlreadyAbsent: cleanup.localAlreadyAbsent,
      remoteDeleted: cleanup.remoteDeleted,
      remoteAlreadyAbsent: cleanup.remoteAlreadyAbsent,
      keptReason: cleanup.keptReason,
      mergedPr: cleanup.mergedPr
        ? { number: cleanup.mergedPr.number, url: cleanup.mergedPr.url }
        : null,
    },
  };

  const branchLine = keepBranch
    ? "kept (--keep-branch)"
    : cleanup.keptReason === "not_merged"
      ? "kept (PR not merged)"
      : branchDeleted
        ? "deleted (local)"
        : cleanup.localAlreadyAbsent
          ? "local already absent"
          : "kept";

  printSuccess("finish", result, {
    json: options.json,
    humanLines: [
      `action:  ${result.action}`,
      `change:  ${result.change}`,
      `worktree:${worktreeRemoved ? " removed" : " (none)"}`,
      `branch:  ${result.branch} (${branchLine})`,
      `remote:  ${
        cleanup.remoteDeleted
          ? "deleted"
          : cleanup.remoteAlreadyAbsent && cleanup.attempted
            ? "already absent"
            : keepBranch || cleanup.keptReason
              ? "kept"
              : "?"
      }`,
      `forced:  ${result.forced}`,
      ...(cleanup.mergedPr
        ? [`pr:      #${cleanup.mergedPr.number} ${cleanup.mergedPr.url}`]
        : []),
    ],
  });

  return result;
}
