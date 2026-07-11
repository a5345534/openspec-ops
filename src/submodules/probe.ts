import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runGit, type GitRunResult } from "../git.js";
import type { SubmoduleStatus } from "../types.js";

export type GitRunner = (
  args: string[],
  options?: { cwd?: string; allowFailure?: boolean },
) => GitRunResult;

export interface ProbeOptions {
  /** Override git runner (tests). Defaults to runGit. */
  runGit?: GitRunner;
}

/**
 * Parse top-level submodule paths from a `.gitmodules` file body.
 * Only `path = ...` under submodule sections; no recursion.
 */
export function parseGitmodulesPaths(content: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*path\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const p = m[1]!.trim();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    paths.push(p);
  }
  return paths;
}

function listTopLevelSubmodulePaths(worktreeRoot: string): string[] {
  const gm = join(worktreeRoot, ".gitmodules");
  if (!existsSync(gm)) return [];
  try {
    return parseGitmodulesPaths(readFileSync(gm, "utf8"));
  } catch {
    return [];
  }
}

function probeOne(
  worktreeRoot: string,
  relPath: string,
  git: GitRunner,
): SubmoduleStatus | null {
  const abs = join(worktreeRoot, relPath);
  // Missing / not checked out: skip (no issue). Listed in .gitmodules only is not enough.
  if (!existsSync(abs)) {
    return null;
  }

  try {
    const inside = git(["rev-parse", "--is-inside-work-tree"], {
      cwd: abs,
      allowFailure: true,
    });
    if (inside.status !== 0 || inside.stdout.trim() !== "true") {
      return null;
    }

    const headRes = git(["rev-parse", "HEAD"], { cwd: abs, allowFailure: true });
    const head = headRes.status === 0 ? headRes.stdout.trim() || null : null;

    const sym = git(["symbolic-ref", "-q", "HEAD"], { cwd: abs, allowFailure: true });
    let detached = true;
    let branch: string | null = null;
    if (sym.status === 0) {
      const ref = sym.stdout.trim(); // refs/heads/foo
      const m = ref.match(/^refs\/heads\/(.+)$/);
      if (m) {
        detached = false;
        branch = m[1]!;
      }
    }

    const st = git(["status", "--porcelain=v1"], { cwd: abs, allowFailure: true });
    const dirty = st.status === 0 && st.stdout.trim().length > 0;

    return {
      path: relPath,
      detached,
      dirty,
      branch,
      head,
    };
  } catch {
    return null;
  }
}

/**
 * Read-only probe of top-level submodules under a change worktree.
 * Fail-open: individual probe failures are skipped; never throws for probe errors.
 */
export function probeTopLevelSubmodules(
  worktreeRoot: string,
  options: ProbeOptions = {},
): SubmoduleStatus[] {
  if (!worktreeRoot || !existsSync(worktreeRoot)) return [];
  const git = options.runGit ?? runGit;
  const paths = listTopLevelSubmodulePaths(worktreeRoot);
  const out: SubmoduleStatus[] = [];
  for (const p of paths) {
    try {
      const one = probeOne(worktreeRoot, p, git);
      if (one) out.push(one);
    } catch {
      // fail-open
    }
  }
  return out;
}

/** Map probe results to doctor issues (detached only; not attached+dirty). */
export function doctorIssuesFromSubmodules(
  worktreePath: string,
  submodules: SubmoduleStatus[],
): Array<{
  id: "submodule_detached" | "submodule_detached_dirty";
  severity: "info" | "warning";
  path: string;
  message: string;
  hint: string;
}> {
  const hint =
    "In the submodule: git switch -c <change> (or use an existing branch), commit there, then commit the parent gitlink. Do not leave long-lived work on detached HEAD. Avoid finish --force until committed.";
  const issues: Array<{
    id: "submodule_detached" | "submodule_detached_dirty";
    severity: "info" | "warning";
    path: string;
    message: string;
    hint: string;
  }> = [];

  for (const s of submodules) {
    if (!s.detached) continue;
    const subPath = join(worktreePath, s.path);
    if (s.dirty) {
      issues.push({
        id: "submodule_detached_dirty",
        severity: "warning",
        path: subPath,
        message: `Submodule ${s.path} is detached HEAD and dirty (uncommitted work at risk if force-finish)`,
        hint,
      });
    } else {
      issues.push({
        id: "submodule_detached",
        severity: "info",
        path: subPath,
        message: `Submodule ${s.path} is on detached HEAD (parent branch ≠ submodule branch)`,
        hint,
      });
    }
  }
  return issues;
}
