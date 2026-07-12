import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runGit, type GitRunResult } from "../git.js";
import { CliError } from "../types.js";
import { parseGitmodulesPaths } from "./probe.js";

export type GitRunner = (
  args: string[],
  options?: { cwd?: string; allowFailure?: boolean },
) => GitRunResult;

export interface TeardownOptions {
  runGit?: GitRunner;
}

function listTopLevelPaths(worktreePath: string): string[] {
  const gm = join(worktreePath, ".gitmodules");
  if (!existsSync(gm)) return [];
  try {
    return parseGitmodulesPaths(readFileSync(gm, "utf8"));
  } catch {
    return [];
  }
}

function looksInitialized(worktreePath: string, relPath: string): boolean {
  const abs = join(worktreePath, relPath);
  if (!existsSync(abs)) return false;
  // submodule checkout has .git file or directory
  return existsSync(join(abs, ".git"));
}

/**
 * Deinitialize initialized top-level submodules inside a change worktree
 * so `git worktree remove` can succeed.
 */
export function prepareWorktreeForRemoval(
  worktreePath: string,
  options: TeardownOptions = {},
): { deinited: string[] } {
  if (!worktreePath || !existsSync(worktreePath)) {
    return { deinited: [] };
  }

  const git = options.runGit ?? runGit;
  const paths = listTopLevelPaths(worktreePath);
  const deinited: string[] = [];
  const failures: Array<{ path: string; message: string }> = [];

  for (const rel of paths) {
    if (!looksInitialized(worktreePath, rel)) continue;
    const res = git(["submodule", "deinit", "-f", "--", rel], {
      cwd: worktreePath,
      allowFailure: true,
    });
    if (res.status !== 0) {
      failures.push({
        path: rel,
        message: (res.stderr || res.stdout || `deinit exit ${res.status}`).trim(),
      });
      continue;
    }
    deinited.push(rel);
  }

  if (failures.length > 0) {
    throw new CliError(
      "submodule_teardown_failed",
      `Failed to deinit submodule(s) under ${worktreePath}: ${failures.map((f) => f.path).join(", ")}. ` +
        `Manually: cd ${worktreePath} && git submodule deinit -f -- <path>, then openspec-ops finish again.`,
      { worktreePath, failures, deinited },
    );
  }

  return { deinited };
}

/** True if git stderr looks like submodule containment refusal. */
export function isSubmoduleContainmentError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("contains submodule") ||
    m.includes("contain submodule") ||
    m.includes("包含子模組") ||
    m.includes("包含子模块")
  );
}
