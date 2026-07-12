import { branchExists, listWorktrees, runGit } from "../git.js";
import { printSuccess } from "../output.js";
import {
  assertChangeName,
  defaultBranch,
  defaultPath,
  resolveRepoContext,
} from "../resolve.js";
import { resolveMergeStatusBackend } from "../ship/backends/gh.js";
import type { MergeStatusBackend, MergedPullRequest } from "../ship/pr-backend.js";
import { CliError, type PruneOptions, type PruneResult } from "../types.js";

export interface PruneDeps {
  resolveRepo: typeof resolveRepoContext;
  listWorktrees: typeof listWorktrees;
  branchExists: typeof branchExists;
  defaultBranch: typeof defaultBranch;
  defaultPath: typeof defaultPath;
  findMergedPr: MergeStatusBackend["findMergedPullRequest"];
  deleteLocalBranch: (cwd: string, branch: string) => void;
  deleteRemoteBranch: (cwd: string, remote: string, branch: string) => void;
  remoteBranchExists: (cwd: string, remote: string, branch: string) => boolean;
}

const defaultDeps: PruneDeps = {
  resolveRepo: resolveRepoContext,
  listWorktrees,
  branchExists,
  defaultBranch,
  defaultPath,
  findMergedPr: (input) => resolveMergeStatusBackend("gh").findMergedPullRequest(input),
  deleteLocalBranch(cwd, branch) {
    // Never -D
    runGit(["branch", "-d", branch], { cwd });
  },
  deleteRemoteBranch(cwd, remote, branch) {
    runGit(["push", remote, "--delete", branch], { cwd });
  },
  remoteBranchExists(cwd, remote, branch) {
    const res = runGit(["ls-remote", "--heads", remote, branch], {
      cwd,
      allowFailure: true,
    });
    if (res.status !== 0) return false;
    return res.stdout.trim().length > 0;
  },
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

export function runPrune(options: PruneOptions, deps: PruneDeps = defaultDeps): PruneResult {
  const change = assertChangeName(options.change);
  const ctx = deps.resolveRepo(options.repo);
  const branch = deps.defaultBranch(change, options.branch);
  const expectedPath = deps.defaultPath(ctx.primaryPath, change, options.path);
  const remote = options.remote || "origin";
  const gitCwd = ctx.primaryPath;

  if (worktreeRegistered(deps, gitCwd, expectedPath, branch)) {
    throw new CliError(
      "worktree_exists",
      `Worktree still registered for '${change}' (${expectedPath} or branch ${branch}). Run openspec-ops finish first.`,
      { change, path: expectedPath, branch },
    );
  }

  let merged: MergedPullRequest | null;
  try {
    merged = deps.findMergedPr({ cwd: gitCwd, head: branch });
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError(
      "pr_failed",
      err instanceof Error ? err.message : String(err),
      { branch },
    );
  }

  if (!merged) {
    throw new CliError(
      "branch_not_merged",
      `No merged PR found for head branch '${branch}'. Refuse to delete unmerged branches.`,
      { change, branch },
    );
  }

  const localExists = deps.branchExists(gitCwd, branch);
  let localDeleted = false;
  let localAlreadyAbsent = false;

  if (!localExists) {
    localAlreadyAbsent = true;
  } else {
    try {
      deps.deleteLocalBranch(gitCwd, branch);
      localDeleted = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new CliError(
        "git_failed",
        `Failed to delete local branch '${branch}' with git branch -d (not using -D). ` +
          `PR is merged; if this is a squash merge, delete manually with git branch -D only if you intend to. ${msg}`,
        { change, branch, mergedPr: merged.number },
      );
    }
  }

  const remoteExists = deps.remoteBranchExists(gitCwd, remote, branch);
  let remoteDeleted = false;
  let remoteAlreadyAbsent = false;

  if (!remoteExists) {
    remoteAlreadyAbsent = true;
  } else {
    try {
      deps.deleteRemoteBranch(gitCwd, remote, branch);
      remoteDeleted = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new CliError(
        "git_failed",
        `Failed to delete remote branch '${remote}/${branch}': ${msg}`,
        {
          change,
          branch,
          remote,
          localDeleted,
          localAlreadyAbsent,
          mergedPr: merged.number,
        },
      );
    }
  }

  const action: PruneResult["action"] =
    localAlreadyAbsent && remoteAlreadyAbsent ? "already_clean" : "pruned";

  const result: PruneResult = {
    action,
    change,
    branch,
    remote,
    mergedPr: {
      number: merged.number,
      url: merged.url,
      baseRefName: merged.baseRefName,
    },
    local: { deleted: localDeleted, alreadyAbsent: localAlreadyAbsent },
    remoteBranch: { deleted: remoteDeleted, alreadyAbsent: remoteAlreadyAbsent },
  };

  printSuccess("prune", result, {
    json: options.json,
    humanLines: [
      `action:  ${result.action}`,
      `change:  ${result.change}`,
      `branch:  ${result.branch}`,
      `remote:  ${result.remote}`,
      `pr:      #${merged.number} ${merged.url}`,
      `local:   ${localDeleted ? "deleted" : localAlreadyAbsent ? "already absent" : "?"}`,
      `remote:  ${remoteDeleted ? "deleted" : remoteAlreadyAbsent ? "already absent" : "?"}`,
    ],
  });

  return result;
}
