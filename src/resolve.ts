import { existsSync } from "node:fs";
import { isAbsolute, join, resolve as resolvePath } from "node:path";
import {
  findPrimaryWorktree,
  isGitRepo,
  listWorktrees,
  showTopLevel,
} from "./git.js";
import { CliError, type WorktreeEntry } from "./types.js";

export const CHANGE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertChangeName(name: string): string {
  if (!CHANGE_NAME_RE.test(name)) {
    throw new CliError(
      "invalid_change_name",
      `Invalid change name '${name}'. Expected kebab-case: /^[a-z0-9]+(?:-[a-z0-9]+)*$/`,
      { change: name },
    );
  }
  return name;
}

export interface RepoContext {
  /** Path used for git commands (any worktree of the repo). */
  cwd: string;
  primaryPath: string;
  worktreeRoot: string;
  worktrees: WorktreeEntry[];
}

export function resolveRepoContext(repoFlag?: string, cwd = process.cwd()): RepoContext {
  const start = repoFlag ? resolvePath(cwd, repoFlag) : cwd;
  if (!isGitRepo(start)) {
    throw new CliError("not_a_git_repo", `Not a git repository: ${start}`, { path: start });
  }

  const toplevel = showTopLevel(start);
  const primary = findPrimaryWorktree(toplevel);
  const worktrees = listWorktrees(toplevel);

  return {
    cwd: toplevel,
    primaryPath: primary.path,
    worktreeRoot: join(primary.path, ".worktrees"),
    worktrees,
  };
}

export function defaultBranch(change: string, branchFlag?: string): string {
  return branchFlag ?? change;
}

export function defaultPath(primaryPath: string, change: string, pathFlag?: string, cwd = process.cwd()): string {
  if (pathFlag) {
    return isAbsolute(pathFlag) ? pathFlag : resolvePath(cwd, pathFlag);
  }
  return join(primaryPath, ".worktrees", change);
}

export function findChangeDir(change: string, worktreePath: string, primaryPath: string): {
  exists: boolean;
  path: string | null;
} {
  const candidates = [
    join(worktreePath, "openspec", "changes", change),
    join(primaryPath, "openspec", "changes", change),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return { exists: true, path: p };
  }
  return { exists: false, path: candidates[0] ?? null };
}

export function hasOpenspecTree(primaryPath: string, worktrees: WorktreeEntry[]): boolean {
  if (existsSync(join(primaryPath, "openspec"))) return true;
  return worktrees.some((wt) => existsSync(join(wt.path, "openspec")));
}

export function inferChangeFromLeaf(leaf: string): string | null {
  return CHANGE_NAME_RE.test(leaf) ? leaf : null;
}
