import { existsSync, mkdirSync } from "node:fs";
import {
  addWorktree,
  branchCheckoutPath,
  branchExists,
  createBranch,
  resolveBaseRef,
  revParse,
} from "../git.js";
import {
  assertChangeName,
  defaultBranch,
  defaultPath,
  findChangeDir,
  resolveRepoContext,
} from "../resolve.js";
import {
  initSubmoduleBranches,
  warningsFromSubmoduleBranchResults,
} from "../submodules/init-branches.js";
import { printSuccess } from "../output.js";
import { CliError, type StartOptions, type StartResult } from "../types.js";

function finishStartResult(
  partial: Omit<StartResult, "submoduleBranches" | "warnings"> & {
    warnings?: StartResult["warnings"];
  },
  options: StartOptions,
): StartResult {
  let submoduleBranches: StartResult["submoduleBranches"] = [];
  const warnings = [...(partial.warnings ?? [])];

  if (options.initSubmoduleBranches) {
    submoduleBranches = initSubmoduleBranches(partial.path, partial.branch);
    warnings.push(...warningsFromSubmoduleBranchResults(submoduleBranches));
  }

  const result: StartResult = {
    ...partial,
    warnings,
    submoduleBranches,
  };

  const branchLines =
    submoduleBranches.length > 0
      ? submoduleBranches.map(
          (s) => `submod:  ${s.path} → ${s.branch} (${s.action})`,
        )
      : [];

  printSuccess("start", result, {
    json: options.json,
    humanLines: [
      `action:  ${result.action}`,
      `change:  ${result.change}`,
      `branch:  ${result.branch}`,
      ...(result.base ? [`base:    ${result.base}`] : []),
      ...branchLines,
      ...(warnings.length
        ? warnings.map((w) => `warn:    ${w.message}`)
        : []),
    ],
  });
  return result;
}

export function runStart(options: StartOptions): StartResult {
  const change = assertChangeName(options.change);
  const ctx = resolveRepoContext(options.repo);
  const branch = defaultBranch(change, options.branch);
  const path = defaultPath(ctx.primaryPath, change, options.path);
  const worktrees = ctx.worktrees;
  const existingAtPath = worktrees.find((w) => w.path === path);

  if (existingAtPath) {
    if (existingAtPath.branch === branch) {
      const head = existingAtPath.head || revParse(path, "HEAD");
      const changeDir = findChangeDir(change, path, ctx.primaryPath);
      return finishStartResult(
        {
          action: "reused",
          change,
          branch,
          path,
          head,
          base: null,
          primaryPath: ctx.primaryPath,
          changeDirExists: changeDir.exists,
        },
        options,
      );
    }
    throw new CliError(
      "branch_mismatch",
      `Path already has worktree for branch '${existingAtPath.branch ?? "(detached)"}', expected '${branch}'`,
      {
        path,
        expectedBranch: branch,
        actualBranch: existingAtPath.branch,
      },
    );
  }

  if (existsSync(path)) {
    throw new CliError(
      "path_not_worktree",
      `Path exists but is not a registered git worktree: ${path}`,
      { path },
    );
  }

  const busyAt = branchCheckoutPath(ctx.cwd, branch);
  if (busyAt && busyAt !== path) {
    throw new CliError(
      "branch_busy",
      `Branch '${branch}' is already checked out at ${busyAt}`,
      { branch, path: busyAt },
    );
  }

  let baseUsed: string | null = null;
  let createdBranch = false;
  if (!branchExists(ctx.cwd, branch)) {
    baseUsed = resolveBaseRef(ctx.cwd, options.base);
    createBranch(ctx.cwd, branch, baseUsed);
    createdBranch = true;
  }

  mkdirSync(ctx.worktreeRoot, { recursive: true });
  addWorktree(ctx.cwd, path, branch);

  const head = revParse(path, "HEAD");
  const changeDir = findChangeDir(change, path, ctx.primaryPath);
  return finishStartResult(
    {
      action: "created",
      change,
      branch,
      path,
      head,
      base: createdBranch ? baseUsed : null,
      primaryPath: ctx.primaryPath,
      changeDirExists: changeDir.exists,
    },
    options,
  );
}
