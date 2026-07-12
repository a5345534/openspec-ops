/**
 * @deprecated Prefer `openspec-ops finish` for closeout (worktree + merged branches).
 * prune remains a thin branch-only entry for compatibility.
 */
import { listWorktrees } from "../git.js";
import { printSuccess } from "../output.js";
import {
  assertChangeName,
  defaultBranch,
  defaultPath,
  resolveRepoContext,
} from "../resolve.js";
import {
  cleanupMergedChangeBranches,
  defaultBranchCleanupDeps,
  type BranchCleanupDeps,
} from "./branch-cleanup.js";
import { CliError, type PruneOptions, type PruneResult } from "../types.js";

export type PruneDeps = BranchCleanupDeps & {
  resolveRepo: typeof resolveRepoContext;
  listWorktrees: typeof listWorktrees;
  defaultBranch: typeof defaultBranch;
  defaultPath: typeof defaultPath;
};

const defaultPruneDeps: PruneDeps = {
  ...defaultBranchCleanupDeps,
  resolveRepo: resolveRepoContext,
  listWorktrees,
  defaultBranch,
  defaultPath,
};

function worktreeRegistered(
  deps: PruneDeps,
  cwd: string,
  expectedPath: string,
  branch: string,
): boolean {
  const trees = deps.listWorktrees(cwd).filter((w) => !w.bare);
  for (const w of trees) {
    if (w.path === expectedPath) return true;
    if (w.branch === branch) return true;
  }
  return false;
}

export function runPrune(options: PruneOptions, deps: PruneDeps = defaultPruneDeps): PruneResult {
  const change = assertChangeName(options.change);
  const ctx = deps.resolveRepo(options.repo);
  const branch = deps.defaultBranch(change, options.branch);
  const expectedPath = deps.defaultPath(ctx.primaryPath, change, options.path);
  const remote = options.remote || "origin";
  const gitCwd = ctx.primaryPath;

  if (worktreeRegistered(deps, gitCwd, expectedPath, branch)) {
    throw new CliError(
      "worktree_exists",
      `Worktree still registered for '${change}'. Prefer: openspec-ops finish ${change} ` +
        `(removes worktree and cleans merged branches). prune is deprecated for primary closeout.`,
      { change, path: expectedPath, branch },
    );
  }

  const cleanup = cleanupMergedChangeBranches(
    {
      change,
      cwd: gitCwd,
      branch,
      remote,
      keepBranch: false,
      strictPrLookup: true,
    },
    deps,
  );

  if (!cleanup.mergedPr) {
    throw new CliError(
      "branch_not_merged",
      `No merged PR found for head branch '${branch}'. Refuse to delete unmerged branches. ` +
        `(Deprecated: prefer openspec-ops finish after merge.)`,
      { change, branch },
    );
  }

  const action: PruneResult["action"] =
    cleanup.localAlreadyAbsent && cleanup.remoteAlreadyAbsent ? "already_clean" : "pruned";

  const result: PruneResult = {
    action,
    change,
    branch,
    remote,
    mergedPr: {
      number: cleanup.mergedPr.number,
      url: cleanup.mergedPr.url,
      baseRefName: cleanup.mergedPr.baseRefName,
    },
    local: {
      deleted: cleanup.localDeleted,
      alreadyAbsent: cleanup.localAlreadyAbsent,
    },
    remoteBranch: {
      deleted: cleanup.remoteDeleted,
      alreadyAbsent: cleanup.remoteAlreadyAbsent,
    },
  };

  printSuccess("prune", result, {
    json: options.json,
    humanLines: [
      `action:  ${result.action} (deprecated: prefer finish)`,
      `change:  ${result.change}`,
      `branch:  ${result.branch}`,
      `remote:  ${result.remote}`,
      `pr:      #${cleanup.mergedPr.number} ${cleanup.mergedPr.url}`,
      `local:   ${cleanup.localDeleted ? "deleted" : cleanup.localAlreadyAbsent ? "already absent" : "?"}`,
      `remote:  ${cleanup.remoteDeleted ? "deleted" : cleanup.remoteAlreadyAbsent ? "already absent" : "?"}`,
    ],
  });

  return result;
}
