import { existsSync, readFileSync, rmSync } from "node:fs";
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

export type PrepareWorktreeResult = {
  deinited: string[];
  /** Residual submodule dirs removed after deinit / hollow leftovers */
  cleared: string[];
};

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
 * Remove a residual submodule work dir when it no longer looks initialized.
 * Safe for post-deinit hollow/empty directories that block worktree remove.
 */
function clearResidualIfSafe(
  worktreePath: string,
  relPath: string,
  cleared: string[],
): void {
  const abs = join(worktreePath, relPath);
  if (!existsSync(abs)) return;
  if (looksInitialized(worktreePath, relPath)) return;
  try {
    rmSync(abs, { recursive: true, force: true });
    cleared.push(relPath);
  } catch {
    // Leave path; removeWorktree / retry may still fail with actionable error
  }
}

/**
 * Deinitialize initialized top-level submodules inside a change worktree
 * so `git worktree remove` can succeed. Also clears residual non-initialized
 * directories for listed submodule paths (common post-deinit leftovers).
 */
export function prepareWorktreeForRemoval(
  worktreePath: string,
  options: TeardownOptions = {},
): PrepareWorktreeResult {
  if (!worktreePath || !existsSync(worktreePath)) {
    return { deinited: [], cleared: [] };
  }

  const git = options.runGit ?? runGit;
  const paths = listTopLevelPaths(worktreePath);
  const deinited: string[] = [];
  const cleared: string[] = [];
  const failures: Array<{ path: string; message: string }> = [];

  for (const rel of paths) {
    if (looksInitialized(worktreePath, rel)) {
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
    // After successful deinit, or if never initialized but dir remains hollow
    clearResidualIfSafe(worktreePath, rel, cleared);
  }

  if (failures.length > 0) {
    throw new CliError(
      "submodule_teardown_failed",
      `Failed to deinit submodule(s) under ${worktreePath}: ${failures.map((f) => f.path).join(", ")}. ` +
        `Manually: cd ${worktreePath} && git submodule deinit -f -- <path>, then openspec-ops finish again.`,
      { worktreePath, failures, deinited, cleared },
    );
  }

  return { deinited, cleared };
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
