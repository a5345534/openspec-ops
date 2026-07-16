import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runGit, type GitRunResult } from "../git.js";
import type {
  SubmoduleBranchDiagnostic,
  SubmoduleStatus,
} from "../types.js";

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
  // Missing, hollow, or not checked out: skip. Requiring the checkout marker
  // prevents Git from walking up and probing the parent repository instead.
  if (!existsSync(abs) || !existsSync(join(abs, ".git"))) {
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

/**
 * Observe same-named local and remote-tracking refs in checked-out top-level
 * submodules. Read-only, network-free, and fail-open per submodule.
 */
export function probeMatchingSubmoduleBranches(
  worktreeRoot: string,
  branch: string,
  options: ProbeOptions = {},
): SubmoduleBranchDiagnostic[] {
  if (!worktreeRoot || !branch || !existsSync(worktreeRoot)) return [];
  const git = options.runGit ?? runGit;
  const diagnostics: SubmoduleBranchDiagnostic[] = [];

  for (const relPath of listTopLevelSubmodulePaths(worktreeRoot)) {
    const abs = join(worktreeRoot, relPath);
    // Require an initialized checkout marker. Without it, Git would walk up
    // from a hollow directory and accidentally probe the parent repository.
    if (!existsSync(abs) || !existsSync(join(abs, ".git"))) continue;
    try {
      const inside = git(["rev-parse", "--is-inside-work-tree"], {
        cwd: abs,
        allowFailure: true,
      });
      if (inside.status !== 0 || inside.stdout.trim() !== "true") continue;

      const symbolic = git(["symbolic-ref", "-q", "--short", "HEAD"], {
        cwd: abs,
        allowFailure: true,
      });
      const currentBranch = symbolic.status === 0 ? symbolic.stdout.trim() : "";
      const local = git(
        ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
        { cwd: abs, allowFailure: true },
      );
      if (local.status === 0) {
        diagnostics.push({
          code: "submodule_change_branch_local",
          path: relPath,
          branch,
          remote: null,
          current: currentBranch === branch,
        });
      }

      const remotes = git(["remote"], { cwd: abs, allowFailure: true });
      if (remotes.status !== 0) continue;
      for (const remote of remotes.stdout
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean)
        .sort()) {
        const tracking = git(
          [
            "show-ref",
            "--verify",
            "--quiet",
            `refs/remotes/${remote}/${branch}`,
          ],
          { cwd: abs, allowFailure: true },
        );
        if (tracking.status !== 0) continue;
        diagnostics.push({
          code: "submodule_change_branch_remote_tracking",
          path: relPath,
          branch,
          remote,
          current: currentBranch === branch,
        });
      }
    } catch {
      // Diagnostics cannot block lifecycle closeout.
    }
  }

  return diagnostics;
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
