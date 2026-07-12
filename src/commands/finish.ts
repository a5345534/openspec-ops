import { removeWorktree } from "../git.js";
import { resolveRepoContext } from "../resolve.js";
import {
  isSubmoduleContainmentError,
  prepareWorktreeForRemoval,
} from "../submodules/teardown.js";
import { locateWorkspace } from "./where.js";
import { printSuccess } from "../output.js";
import { CliError, type FinishOptions, type FinishResult } from "../types.js";

export function runFinish(options: FinishOptions): FinishResult {
  const loc = locateWorkspace(options);
  const ctx = resolveRepoContext(options.repo);

  if (loc.dirty && !options.force) {
    throw new CliError(
      "worktree_dirty",
      `Worktree is dirty: ${loc.path}. Dirtiness may include uncommitted submodule changes. ` +
        `Commit/stash (submodule first, then parent gitlink) or pass --force ` +
        `(discards uncommitted work, including inside submodules).`,
      { path: loc.path, change: loc.change },
    );
  }

  // Unload top-level submodules so git worktree remove can succeed
  prepareWorktreeForRemoval(loc.path);

  try {
    removeWorktree(ctx.cwd, loc.path, options.force);
  } catch (err) {
    if (err instanceof CliError) {
      const msg = err.message || "";
      if (isSubmoduleContainmentError(msg) || err.code === "git_failed") {
        if (isSubmoduleContainmentError(msg)) {
          throw new CliError(
            "submodule_teardown_failed",
            `Cannot remove worktree ${loc.path}: still contains submodules after prepare. ` +
              `Manually: cd ${loc.path} && git submodule deinit -f -- <path>, then retry finish. ${msg}`,
            { path: loc.path, change: loc.change, cause: msg },
          );
        }
      }
      throw err;
    }
    throw err;
  }

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
