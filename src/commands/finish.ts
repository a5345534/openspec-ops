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
import {
  closeoutHintMessages,
  detectPrimaryBehindOrigin,
} from "../doctor/primary-closeout.js";
import { locateWorkspace } from "./where.js";
import {
  cleanupMergedChangeBranches,
  type BranchCleanupDeps,
  defaultBranchCleanupDeps,
} from "./branch-cleanup.js";
import {
  attachSubmodulesToMainIfSafe,
  defaultFinishSyncDeps,
  syncPrimaryCheckout,
  syncPrimarySubmodules,
  type FinishSyncDeps,
} from "./finish-sync.js";
import { printSuccess } from "../output.js";
import {
  CliError,
  type FinishCloseoutHints,
  type FinishOptions,
  type FinishResult,
  type FinishSyncResult,
} from "../types.js";

export type FinishDeps = {
  locate: typeof locateWorkspace;
  resolveRepo: typeof resolveRepoContext;
  prepare: typeof prepareWorktreeForRemoval;
  removeWorktree: typeof removeWorktree;
  branchCleanup: typeof cleanupMergedChangeBranches;
  branchCleanupDeps?: BranchCleanupDeps;
  finishSyncDeps?: FinishSyncDeps;
  detectBehind?: typeof detectPrimaryBehindOrigin;
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
  const wantSyncPrimary = Boolean(options.syncPrimary);
  const wantSyncSubs = Boolean(options.syncSubmodules);
  const wantAttach = Boolean(options.attachSubmoduleMain);

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

    const failContainment = (msg: string): never => {
      throw new CliError(
        "submodule_teardown_failed",
        `Cannot remove worktree ${loc.path}: still contains submodules after prepare. ` +
          `Manually: cd ${loc.path} && git submodule deinit -f -- <path>, remove residual dirs if empty, then retry finish. ${msg}`,
        { path: loc.path, change: loc.change, cause: msg },
      );
    };

    try {
      deps.removeWorktree(ctx.cwd, loc.path, force);
    } catch (err) {
      if (err instanceof CliError) {
        const msg = err.message || "";
        if (isSubmoduleContainmentError(msg)) {
          // Re-prepare (clear residual dirs) and retry remove once
          deps.prepare(loc.path);
          try {
            deps.removeWorktree(ctx.cwd, loc.path, force);
          } catch (err2) {
            if (err2 instanceof CliError) {
              const msg2 = err2.message || "";
              if (isSubmoduleContainmentError(msg2)) {
                failContainment(msg2);
              }
              throw err2;
            }
            throw err2;
          }
        } else {
          throw err;
        }
      } else {
        throw err;
      }
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

  const detectBehind = deps.detectBehind ?? detectPrimaryBehindOrigin;
  const behind = detectBehind(ctx.primaryPath, { remote });
  const closeoutHints: FinishCloseoutHints = {
    primaryBehindOrigin: behind.behind,
    originBaseRef: behind.originBaseRef,
    baseBranch: behind.baseBranch,
    messages: closeoutHintMessages(ctx.primaryPath, behind),
  };

  const sync: FinishSyncResult = {
    syncPrimary: wantSyncPrimary ? "failed" : "skipped",
    syncSubmodules: wantSyncSubs ? "failed" : "skipped",
    attachSubmoduleMain: wantAttach ? "failed" : "skipped",
    attached: [],
    diverged: [],
  };

  const syncDeps = deps.finishSyncDeps ?? defaultFinishSyncDeps;
  const syncCtx = { worktreeRemoved, remote };

  // Opt-in primary closeout (after workspace closeout). Failures rethrow with worktreeRemoved detail.
  if (wantSyncPrimary) {
    syncPrimaryCheckout(ctx.primaryPath, syncCtx, syncDeps);
    sync.syncPrimary = "ok";
  }
  if (wantSyncSubs) {
    syncPrimarySubmodules(ctx.primaryPath, syncCtx, syncDeps);
    sync.syncSubmodules = "ok";
  }
  if (wantAttach) {
    const att = attachSubmodulesToMainIfSafe(ctx.primaryPath, {}, syncDeps);
    sync.attached = att.attached;
    sync.diverged = att.diverged;
    if (att.diverged.length > 0 && att.attached.length === 0 && att.skipped.length >= 0) {
      // partial if any diverged with some attached, else ok if only attached/skipped
      sync.attachSubmoduleMain = att.attached.length > 0 ? "partial" : "partial";
    } else if (att.diverged.length > 0) {
      sync.attachSubmoduleMain = "partial";
    } else {
      sync.attachSubmoduleMain = "ok";
    }
    if (att.diverged.length > 0) {
      closeoutHints.messages.push(
        `submodule_main_diverged: ${att.diverged.join(", ")} (left at pin; no force)`,
      );
    }
  }

  // Refresh behind hint after optional sync-primary
  if (wantSyncPrimary) {
    const behind2 = detectBehind(ctx.primaryPath, { remote });
    closeoutHints.primaryBehindOrigin = behind2.behind;
    closeoutHints.originBaseRef = behind2.originBaseRef;
    closeoutHints.baseBranch = behind2.baseBranch;
    if (!behind2.behind) {
      closeoutHints.messages = closeoutHints.messages.filter(
        (m) => !m.includes("Primary is behind"),
      );
    }
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
    closeoutHints,
    sync,
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
      ...(closeoutHints.messages.length
        ? closeoutHints.messages.map((m) => `hint:    ${m}`)
        : []),
      ...(wantSyncPrimary || wantSyncSubs || wantAttach
        ? [
            `sync:    primary=${sync.syncPrimary} submodules=${sync.syncSubmodules} attach=${sync.attachSubmoduleMain}`,
          ]
        : []),
    ],
  });

  return result;
}
