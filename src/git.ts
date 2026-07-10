import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { CliError, type WorktreeEntry } from "./types.js";

export interface GitRunResult {
  stdout: string;
  stderr: string;
  status: number;
}

export function runGit(
  args: string[],
  options: { cwd?: string; allowFailure?: boolean } = {},
): GitRunResult {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: "0",
    },
  });

  if (result.error) {
    throw new CliError("git_failed", `Failed to spawn git: ${result.error.message}`, {
      args,
      error: result.error.message,
    });
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const status = result.status ?? 10;

  if (status !== 0 && !options.allowFailure) {
    throw new CliError("git_failed", stderr.trim() || `git ${args.join(" ")} failed`, {
      args,
      status,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
    });
  }

  return { stdout, stderr, status };
}

export function gitOk(args: string[], cwd?: string): boolean {
  return runGit(args, { cwd, allowFailure: true }).status === 0;
}

export function gitStdout(args: string[], cwd?: string): string {
  return runGit(args, { cwd }).stdout.trim();
}

export function isGitRepo(cwd: string): boolean {
  return gitOk(["rev-parse", "--is-inside-work-tree"], cwd);
}

export function showTopLevel(cwd: string): string {
  return gitStdout(["rev-parse", "--show-toplevel"], cwd);
}

export function listWorktrees(cwd: string): WorktreeEntry[] {
  const raw = runGit(["worktree", "list", "--porcelain"], { cwd }).stdout;
  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> | null = null;

  const flush = () => {
    if (!current?.path) return;
    entries.push({
      path: current.path,
      head: current.head ?? "",
      branch: current.branch ?? null,
      bare: current.bare ?? false,
      detached: current.detached ?? false,
    });
    current = null;
  };

  for (const line of raw.split("\n")) {
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith("worktree ")) {
      flush();
      current = { path: line.slice("worktree ".length), bare: false, detached: false };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      const ref = line.slice("branch ".length);
      current.branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
    } else if (line === "bare") {
      current.bare = true;
    } else if (line === "detached") {
      current.detached = true;
    }
  }
  flush();
  return entries;
}

export function findPrimaryWorktree(cwd: string): WorktreeEntry {
  const entries = listWorktrees(cwd).filter((e) => !e.bare);
  if (entries.length === 0) {
    throw new CliError("primary_unresolved", "Could not resolve primary worktree", { cwd });
  }
  // First porcelain entry is the main worktree.
  return entries[0]!;
}

export function branchExists(cwd: string, branch: string): boolean {
  return gitOk(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd);
}

export function branchCheckoutPath(cwd: string, branch: string): string | null {
  const hit = listWorktrees(cwd).find((e) => e.branch === branch);
  return hit?.path ?? null;
}

export function isDirty(worktreePath: string): boolean {
  if (!existsSync(worktreePath)) return false;
  const out = runGit(["status", "--porcelain=v1"], { cwd: worktreePath }).stdout;
  return out.trim().length > 0;
}

export function revParse(cwd: string, rev: string): string {
  return gitStdout(["rev-parse", rev], cwd);
}

export function refExists(cwd: string, rev: string): boolean {
  return gitOk(["rev-parse", "--verify", "--quiet", rev], cwd);
}

export function createBranch(cwd: string, branch: string, base: string): void {
  runGit(["branch", branch, base], { cwd });
}

export function addWorktree(cwd: string, path: string, branch: string): void {
  runGit(["worktree", "add", path, branch], { cwd });
}

export function removeWorktree(cwd: string, path: string, force = false): void {
  const args = ["worktree", "remove"];
  if (force) args.push("--force");
  args.push(path);
  runGit(args, { cwd });
}

export function resolveBaseRef(cwd: string, explicit?: string): string {
  if (explicit) {
    if (!refExists(cwd, explicit)) {
      throw new CliError("base_unresolved", `Base ref not found: ${explicit}`, { base: explicit });
    }
    return explicit;
  }

  const originHead = runGit(["symbolic-ref", "refs/remotes/origin/HEAD"], {
    cwd,
    allowFailure: true,
  });
  if (originHead.status === 0) {
    const ref = originHead.stdout.trim(); // e.g. refs/remotes/origin/main
    if (ref) return ref.replace(/^refs\/remotes\//, "");
  }

  for (const candidate of ["main", "master"]) {
    if (branchExists(cwd, candidate)) return candidate;
  }

  throw new CliError(
    "base_unresolved",
    "Could not resolve a base ref (tried origin/HEAD, main, master)",
    {},
  );
}
