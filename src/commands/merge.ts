import {
  assertPullRequestChecksGreen,
  findOpenPullRequest,
  mergePullRequest,
  resolveMergeStatusBackend,
  type GhMergeMethod,
  type OpenPullRequest,
} from "../ship/backends/gh.js";
import type { MergedPullRequest } from "../ship/pr-backend.js";
import { printSuccess } from "../output.js";
import {
  assertChangeName,
  defaultBranch,
  resolveRepoContext,
} from "../resolve.js";
import {
  CliError,
  type MergeMethod,
  type MergeOptions,
  type MergeResult,
} from "../types.js";

export function parseMergeMethod(raw: string | undefined): MergeMethod {
  const m = (raw ?? "squash").trim().toLowerCase();
  if (m === "squash" || m === "merge" || m === "rebase") return m;
  throw new CliError(
    "usage",
    `Invalid --method '${raw}'. Expected squash|merge|rebase`,
    { method: raw },
  );
}

export interface MergeDeps {
  resolveRepo: typeof resolveRepoContext;
  defaultBranch: typeof defaultBranch;
  findOpenPr: (cwd: string, head: string) => OpenPullRequest | null;
  findMergedPr: (cwd: string, head: string) => MergedPullRequest | null;
  assertChecksGreen: (cwd: string, prNumber: number) => void;
  mergePr: (cwd: string, prNumber: number, method: GhMergeMethod) => void;
}

const defaultDeps: MergeDeps = {
  resolveRepo: resolveRepoContext,
  defaultBranch,
  findOpenPr: findOpenPullRequest,
  findMergedPr: (cwd, head) =>
    resolveMergeStatusBackend("gh").findMergedPullRequest({ cwd, head }),
  assertChecksGreen: assertPullRequestChecksGreen,
  mergePr: mergePullRequest,
};

export function runMerge(options: MergeOptions, deps: MergeDeps = defaultDeps): MergeResult {
  const change = assertChangeName(options.change);
  const ctx = deps.resolveRepo(options.repo);
  const branch = deps.defaultBranch(change, options.branch);
  const method = options.method ?? "squash";
  const cwd = ctx.primaryPath;

  let open: OpenPullRequest | null;
  try {
    open = deps.findOpenPr(cwd, branch);
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError("pr_failed", err instanceof Error ? err.message : String(err), {
      branch,
    });
  }

  if (!open) {
    let merged: MergedPullRequest | null = null;
    try {
      merged = deps.findMergedPr(cwd, branch);
    } catch (err) {
      if (err instanceof CliError && err.code === "pr_backend_unavailable") throw err;
      // ignore list errors and fall through to not found
    }
    if (merged) {
      const result: MergeResult = {
        action: "already_merged",
        change,
        branch,
        method,
        pr: { number: merged.number, url: merged.url },
      };
      printSuccess("merge", result, {
        json: options.json,
        humanLines: [
          `action:  already_merged`,
          `change:  ${change}`,
          `branch:  ${branch}`,
          `pr:      #${merged.number} ${merged.url}`,
          `next:    archive → finish → prune (not run by merge)`,
        ],
      });
      return result;
    }
    throw new CliError(
      "pr_not_found",
      `No open PR found for head branch '${branch}'. Ship first or check branch name.`,
      { change, branch },
    );
  }

  deps.assertChecksGreen(cwd, open.number);
  deps.mergePr(cwd, open.number, method);

  const result: MergeResult = {
    action: "merged",
    change,
    branch,
    method,
    pr: { number: open.number, url: open.url },
  };

  printSuccess("merge", result, {
    json: options.json,
    humanLines: [
      `action:  merged`,
      `change:  ${change}`,
      `branch:  ${branch}`,
      `method:  ${method}`,
      `pr:      #${open.number} ${open.url}`,
      `next:    archive → finish → prune (not run by merge)`,
    ],
  });

  return result;
}
