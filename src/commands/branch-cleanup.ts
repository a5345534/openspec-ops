import { branchExists, runGit } from "../git.js";
import { resolveMergeStatusBackend } from "../ship/backends/gh.js";
import type { MergedPullRequest } from "../ship/pr-backend.js";
import { CliError } from "../types.js";

export type BranchCleanupDeps = {
  findMergedPr: (input: { cwd: string; head: string }) => MergedPullRequest | null;
  branchExists: (cwd: string, branch: string) => boolean;
  deleteLocalBranch: (cwd: string, branch: string) => void;
  deleteRemoteBranch: (cwd: string, remote: string, branch: string) => void;
  remoteBranchExists: (cwd: string, remote: string, branch: string) => boolean;
};

export type BranchCleanupResult = {
  attempted: boolean;
  mergedPr: MergedPullRequest | null;
  localDeleted: boolean;
  localAlreadyAbsent: boolean;
  remoteDeleted: boolean;
  remoteAlreadyAbsent: boolean;
  keptReason: "not_merged" | "keep_flag" | null;
};

export const defaultBranchCleanupDeps: BranchCleanupDeps = {
  findMergedPr: (input) =>
    resolveMergeStatusBackend("gh").findMergedPullRequest(input),
  branchExists,
  deleteLocalBranch(cwd, branch) {
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

/**
 * Delete local+remote branches when PR is merged. Never -D.
 * If keepBranch, returns keptReason keep_flag without deleting.
 */
export function cleanupMergedChangeBranches(
  input: {
    change: string;
    cwd: string;
    branch: string;
    remote: string;
    keepBranch: boolean;
    /** When true (prune), PR lookup failure is fatal. Finish defaults soft. */
    strictPrLookup?: boolean;
  },
  deps: BranchCleanupDeps = defaultBranchCleanupDeps,
): BranchCleanupResult {
  if (input.keepBranch) {
    return {
      attempted: false,
      mergedPr: null,
      localDeleted: false,
      localAlreadyAbsent: false,
      remoteDeleted: false,
      remoteAlreadyAbsent: false,
      keptReason: "keep_flag",
    };
  }

  let merged: MergedPullRequest | null;
  try {
    merged = deps.findMergedPr({ cwd: input.cwd, head: input.branch });
  } catch (err) {
    // Soft: unavailable PR status → do not delete (caller may rethrow for prune)
    if (input.strictPrLookup) {
      if (err instanceof CliError) throw err;
      throw new CliError(
        "pr_failed",
        err instanceof Error ? err.message : String(err),
        { branch: input.branch },
      );
    }
    return {
      attempted: false,
      mergedPr: null,
      localDeleted: false,
      localAlreadyAbsent: false,
      remoteDeleted: false,
      remoteAlreadyAbsent: false,
      keptReason: "not_merged",
    };
  }

  if (!merged) {
    return {
      attempted: false,
      mergedPr: null,
      localDeleted: false,
      localAlreadyAbsent: false,
      remoteDeleted: false,
      remoteAlreadyAbsent: false,
      keptReason: "not_merged",
    };
  }

  const localExists = deps.branchExists(input.cwd, input.branch);
  let localDeleted = false;
  let localAlreadyAbsent = false;

  if (!localExists) {
    localAlreadyAbsent = true;
  } else {
    try {
      deps.deleteLocalBranch(input.cwd, input.branch);
      localDeleted = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new CliError(
        "git_failed",
        `Failed to delete local branch '${input.branch}' with git branch -d (not using -D). ` +
          `PR is merged; if this is a squash merge, delete manually with git branch -D only if you intend to. ${msg}`,
        { change: input.change, branch: input.branch, mergedPr: merged.number },
      );
    }
  }

  const remoteExists = deps.remoteBranchExists(input.cwd, input.remote, input.branch);
  let remoteDeleted = false;
  let remoteAlreadyAbsent = false;

  if (!remoteExists) {
    remoteAlreadyAbsent = true;
  } else {
    try {
      deps.deleteRemoteBranch(input.cwd, input.remote, input.branch);
      remoteDeleted = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new CliError(
        "git_failed",
        `Failed to delete remote branch '${input.remote}/${input.branch}': ${msg}`,
        {
          change: input.change,
          branch: input.branch,
          remote: input.remote,
          localDeleted,
          localAlreadyAbsent,
          mergedPr: merged.number,
        },
      );
    }
  }

  return {
    attempted: true,
    mergedPr: merged,
    localDeleted,
    localAlreadyAbsent,
    remoteDeleted,
    remoteAlreadyAbsent,
    keptReason: null,
  };
}
