import { removeWorktree } from "../git.js";
import { resolveRepoContext } from "../resolve.js";
import { locateWorkspace } from "./where.js";
import { printSuccess } from "../output.js";
import { CliError, type FinishOptions, type FinishResult } from "../types.js";

export function runFinish(options: FinishOptions): FinishResult {
  const loc = locateWorkspace(options);
  const ctx = resolveRepoContext(options.repo);

  if (loc.dirty && !options.force) {
    throw new CliError(
      "worktree_dirty",
      `Worktree is dirty: ${loc.path}. Commit/stash changes or pass --force.`,
      { path: loc.path, change: loc.change },
    );
  }

  removeWorktree(ctx.cwd, loc.path, options.force);

  const result: FinishResult = {
    action: "removed",
    change: loc.change,
    path: loc.path,
    branch: loc.branch,
    branchDeleted: false,
    forced: options.force && loc.dirty,
  };

  printSuccess("finish", result, {
    json: options.json,
    humanLines: [
      `action:  removed`,
      `change:  ${result.change}`,
      `branch:  ${result.branch} (kept)`,
      `forced:  ${result.forced}`,
    ],
  });
  return result;
}
