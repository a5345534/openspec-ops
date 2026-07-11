import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDirty } from "../git.js";
import { collectEnvDoctorIssues } from "../doctor/env-checks.js";
import { resolvePackageRoot } from "../package-root.js";
import {
  findChangeDir,
  hasOpenspecTree,
  inferChangeFromLeaf,
  resolveRepoContext,
} from "../resolve.js";
import {
  doctorIssuesFromSubmodules,
  probeTopLevelSubmodules,
} from "../submodules/probe.js";
import { printSuccess } from "../output.js";
import type { DoctorIssue, DoctorResult, DoctorWorktree, GlobalOptions } from "../types.js";

export function runDoctor(options: GlobalOptions): DoctorResult {
  const ctx = resolveRepoContext(options.repo);
  const issues: DoctorIssue[] = [];

  const linked = ctx.worktrees.filter((w) => w.path !== ctx.primaryPath && !w.bare);
  const worktrees: DoctorWorktree[] = linked.map((w) => {
    const leaf = basename(w.path);
    return {
      path: w.path,
      branch: w.branch,
      head: w.head,
      dirty: existsSync(w.path) ? isDirty(w.path) : false,
      inferredChange: inferChangeFromLeaf(leaf),
    };
  });

  for (const w of linked) {
    if (!existsSync(w.path)) {
      issues.push({
        id: "missing_worktree_path",
        severity: "error",
        path: w.path,
        message: "Registered worktree path is missing on disk",
        hint: "Run git worktree prune",
      });
    }
  }

  if (existsSync(ctx.worktreeRoot)) {
    let entries: string[] = [];
    try {
      entries = readdirSync(ctx.worktreeRoot);
    } catch {
      entries = [];
    }
    const registered = new Set(ctx.worktrees.map((w) => w.path));
    for (const name of entries) {
      const full = join(ctx.worktreeRoot, name);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;
      if (!registered.has(full)) {
        issues.push({
          id: "stale_worktree_dir",
          severity: "warning",
          path: full,
          message: "Directory exists but is not a registered git worktree",
          hint: "Remove manually or re-register",
        });
      }
    }
  }

  if (hasOpenspecTree(ctx.primaryPath, ctx.worktrees)) {
    for (const wt of worktrees) {
      if (!wt.inferredChange) continue;
      if (!existsSync(wt.path)) continue;
      const changeDir = findChangeDir(wt.inferredChange, wt.path, ctx.primaryPath);
      if (!changeDir.exists) {
        issues.push({
          id: "worktree_without_change_dir",
          severity: "info",
          path: wt.path,
          message: `No openspec/changes/${wt.inferredChange} directory found in worktree or primary`,
        });
        if (wt.dirty) {
          issues.push({
            id: "leftover_dirty_worktree",
            severity: "warning",
            path: wt.path,
            message: `Worktree for ${wt.inferredChange} is dirty and has no active change dir (possible post-archive leftover)`,
            hint: "Commit/ship the branch, or openspec-ops finish --force with explicit consent",
          });
        }
      } else {
        // change exists only on primary while worktree is registered
        const onWt = existsSync(
          join(wt.path, "openspec", "changes", wt.inferredChange),
        );
        const onPrimary = existsSync(
          join(ctx.primaryPath, "openspec", "changes", wt.inferredChange),
        );
        if (onPrimary && !onWt) {
          issues.push({
            id: "artifacts_on_primary_only",
            severity: "warning",
            path: wt.path,
            message: `Change ${wt.inferredChange} artifacts are on primary only while worktree exists`,
            hint: "Prefer writing under worktree path from openspec-ops where; see docs/snippets/worktree-alignment-block.md",
          });
        }
      }
    }
  }

  // Submodule hygiene (top-level, read-only; fail-open)
  for (const wt of worktrees) {
    if (!existsSync(wt.path)) continue;
    try {
      const subs = probeTopLevelSubmodules(wt.path);
      for (const issue of doctorIssuesFromSubmodules(wt.path, subs)) {
        issues.push(issue);
      }
    } catch {
      // fail-open
    }
  }

  // Env / intercept / propose skill markers (package root when this CLI is from openspec-ops)
  let packageRoot = ctx.primaryPath;
  try {
    packageRoot = resolvePackageRoot(dirname(fileURLToPath(import.meta.url)));
  } catch {
    packageRoot = ctx.primaryPath;
  }
  for (const e of collectEnvDoctorIssues({
    primaryPath: ctx.primaryPath,
    packageRoot,
  })) {
    issues.push(e);
  }

  const summary = {
    error: issues.filter((i) => i.severity === "error").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };

  const result: DoctorResult = {
    primaryPath: ctx.primaryPath,
    worktreeRoot: ctx.worktreeRoot,
    worktrees,
    issues,
    summary,
  };

  printSuccess("doctor", result, {
    json: options.json,
    humanLines: [
      `primary: ${result.primaryPath}`,
      `root:    ${result.worktreeRoot}`,
      `worktrees: ${result.worktrees.length}`,
      `issues:  error=${summary.error} warning=${summary.warning} info=${summary.info}`,
      ...issues.map((i) => `- [${i.severity}] ${i.id}: ${i.path}`),
    ],
  });
  return result;
}
