import { existsSync } from "node:fs";
import { join } from "node:path";
import { runGit, type GitRunResult } from "../git.js";
import { probeTopLevelSubmodules, type GitRunner } from "./probe.js";

export type SubmoduleBranchAction =
  | "created"
  | "switched"
  | "skipped"
  | "failed";

export type SubmoduleBranchResult = {
  path: string;
  branch: string;
  action: SubmoduleBranchAction;
  message?: string;
};

export type InitSubmoduleBranchesDeps = {
  runGit?: GitRunner;
  probe?: typeof probeTopLevelSubmodules;
};

/**
 * For each checked-out top-level submodule on detached HEAD, create or switch
 * to `branchName`. Never commits. Fail-open per submodule.
 */
export function initSubmoduleBranches(
  worktreeRoot: string,
  branchName: string,
  deps: InitSubmoduleBranchesDeps = {},
): SubmoduleBranchResult[] {
  const git = deps.runGit ?? runGit;
  const probe = deps.probe ?? probeTopLevelSubmodules;
  const out: SubmoduleBranchResult[] = [];

  if (!worktreeRoot || !branchName) {
    return out;
  }
  // When using real probe, require path on disk; tests inject probe without FS.
  if (!deps.probe && !existsSync(worktreeRoot)) {
    return out;
  }

  const subs = probe(worktreeRoot, { runGit: git });
  for (const s of subs) {
    if (!s.detached) {
      out.push({
        path: s.path,
        branch: s.branch ?? branchName,
        action: "skipped",
        message: "already on a branch",
      });
      continue;
    }

    const abs = join(worktreeRoot, s.path);
    try {
      const exists = git(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
        cwd: abs,
        allowFailure: true,
      });
      if (exists.status === 0) {
        const sw = git(["switch", branchName], { cwd: abs, allowFailure: true });
        if (sw.status !== 0) {
          out.push({
            path: s.path,
            branch: branchName,
            action: "failed",
            message: (sw.stderr || sw.stdout || "git switch failed").trim(),
          });
          continue;
        }
        out.push({ path: s.path, branch: branchName, action: "switched" });
        continue;
      }

      const create = git(["switch", "-c", branchName], {
        cwd: abs,
        allowFailure: true,
      });
      if (create.status !== 0) {
        out.push({
          path: s.path,
          branch: branchName,
          action: "failed",
          message: (create.stderr || create.stdout || "git switch -c failed").trim(),
        });
        continue;
      }
      out.push({ path: s.path, branch: branchName, action: "created" });
    } catch (err) {
      out.push({
        path: s.path,
        branch: branchName,
        action: "failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return out;
}

export function warningsFromSubmoduleBranchResults(
  results: SubmoduleBranchResult[],
): Array<{ code: string; message: string }> {
  return results
    .filter((r) => r.action === "failed")
    .map((r) => ({
      code: "submodule_branch_init_failed",
      message: `Submodule ${r.path}: failed to attach branch '${r.branch}': ${r.message ?? "unknown"}`,
    }));
}
