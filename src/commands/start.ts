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
import { printSuccess } from "../output.js";
import { CliError, type StartOptions, type StartResult } from "../types.js";

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
      const result: StartResult = {
        action: "reused",
        change,
        branch,
        path,
        head,
        base: null,
        primaryPath: ctx.primaryPath,
        changeDirExists: changeDir.exists,
        warnings: [],
      };
      printSuccess("start", result, {
        json: options.json,
        humanLines: [
          `action:  reused`,
          `change:  ${change}`,
          `branch:  ${branch}`,
        ],
      });
      return result;
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
  const result: StartResult = {
    action: "created",
    change,
    branch,
    path,
    head,
    base: createdBranch ? baseUsed : null,
    primaryPath: ctx.primaryPath,
    changeDirExists: changeDir.exists,
    warnings: [],
  };

  printSuccess("start", result, {
    json: options.json,
    humanLines: [
      `action:  created`,
      `change:  ${change}`,
      `branch:  ${branch}`,
      ...(baseUsed ? [`base:    ${baseUsed}`] : []),
    ],
  });
  return result;
}
