import { isDirty, refExists, resolveBaseRef, revParse, runGit } from "../git.js";
import { toBaseBranchName } from "./ship.js";
import { probeTopLevelSubmodules } from "../submodules/probe.js";
import { CliError } from "../types.js";
import type { GitRunResult } from "../git.js";

export type GitRunner = (
  args: string[],
  options?: { cwd?: string; allowFailure?: boolean },
) => GitRunResult;

export type SyncPrimaryResult = {
  ok: true;
  baseBranch: string;
  head: string;
};

export type SyncSubmodulesResult = {
  ok: true;
};

export type AttachSubmoduleResult = {
  attached: string[];
  diverged: string[];
  skipped: string[];
};

export type FinishSyncDeps = {
  isDirty: (path: string) => boolean;
  resolveBase: (cwd: string, explicit?: string) => string;
  revParse: (cwd: string, rev: string) => string;
  refExists: (cwd: string, rev: string) => boolean;
  runGit: GitRunner;
  probe: typeof probeTopLevelSubmodules;
};

export const defaultFinishSyncDeps: FinishSyncDeps = {
  isDirty,
  resolveBase: resolveBaseRef,
  revParse,
  refExists,
  runGit,
  probe: probeTopLevelSubmodules,
};

/**
 * Place primary on default base and ff-only pull origin/<base>.
 * Throws CliError primary_dirty | sync_primary_failed | primary_diverged.
 */
export function syncPrimaryCheckout(
  primaryPath: string,
  options: { remote?: string; worktreeRemoved?: boolean } = {},
  deps: FinishSyncDeps = defaultFinishSyncDeps,
): SyncPrimaryResult {
  const remote = options.remote ?? "origin";
  const detailsBase = {
    primaryPath,
    worktreeRemoved: Boolean(options.worktreeRemoved),
  };

  if (deps.isDirty(primaryPath)) {
    throw new CliError(
      "primary_dirty",
      `Cannot --sync-primary: primary worktree is dirty: ${primaryPath}`,
      detailsBase,
    );
  }

  let baseResolved: string;
  try {
    baseResolved = deps.resolveBase(primaryPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new CliError(
      "sync_primary_failed",
      `Cannot --sync-primary: base unresolved. ${msg}`,
      detailsBase,
    );
  }
  const baseBranch = toBaseBranchName(baseResolved);
  const originBase = `${remote}/${baseBranch}`;

  if (!deps.refExists(primaryPath, originBase)) {
    throw new CliError(
      "sync_primary_failed",
      `Cannot --sync-primary: missing remote-tracking ref ${originBase} (run git fetch ${remote})`,
      { ...detailsBase, originBase },
    );
  }

  // Stay on base or switch when clean
  const sym = deps.runGit(["symbolic-ref", "-q", "HEAD"], {
    cwd: primaryPath,
    allowFailure: true,
  });
  let onBase = false;
  if (sym.status === 0) {
    const m = sym.stdout.trim().match(/^refs\/heads\/(.+)$/);
    onBase = m?.[1] === baseBranch;
  }
  if (!onBase) {
    const sw = deps.runGit(["switch", baseBranch], {
      cwd: primaryPath,
      allowFailure: true,
    });
    if (sw.status !== 0) {
      throw new CliError(
        "sync_primary_failed",
        `Cannot --sync-primary: failed to switch to ${baseBranch}: ${sw.stderr || sw.stdout}`,
        { ...detailsBase, baseBranch },
      );
    }
  }

  const pull = deps.runGit(["pull", "--ff-only", remote, baseBranch], {
    cwd: primaryPath,
    allowFailure: true,
  });
  if (pull.status !== 0) {
    const combined = `${pull.stderr}\n${pull.stdout}`.toLowerCase();
    const diverged =
      combined.includes("not possible to fast-forward") ||
      combined.includes("diverging") ||
      combined.includes("need to specify how to reconcile") ||
      combined.includes("refusing to merge unrelated");
    throw new CliError(
      diverged ? "primary_diverged" : "sync_primary_failed",
      diverged
        ? `Cannot --sync-primary: primary and ${originBase} have diverged (ff-only refused)`
        : `Cannot --sync-primary: pull --ff-only failed: ${pull.stderr || pull.stdout}`,
      { ...detailsBase, baseBranch, originBase },
    );
  }

  const head = deps.revParse(primaryPath, "HEAD");
  return { ok: true, baseBranch, head };
}

export function syncPrimarySubmodules(
  primaryPath: string,
  options: { worktreeRemoved?: boolean } = {},
  deps: FinishSyncDeps = defaultFinishSyncDeps,
): SyncSubmodulesResult {
  const up = deps.runGit(
    ["submodule", "update", "--init", "--recursive"],
    { cwd: primaryPath, allowFailure: true },
  );
  if (up.status !== 0) {
    throw new CliError(
      "sync_submodules_failed",
      `Cannot --sync-submodules: ${up.stderr || up.stdout}`,
      {
        primaryPath,
        worktreeRemoved: Boolean(options.worktreeRemoved),
      },
    );
  }
  return { ok: true };
}

/**
 * Non-destructive attach of top-level submodules to main when pin is safe.
 */
export function attachSubmodulesToMainIfSafe(
  primaryPath: string,
  options: { branch?: string } = {},
  deps: FinishSyncDeps = defaultFinishSyncDeps,
): AttachSubmoduleResult {
  const branch = options.branch ?? "main";
  const attached: string[] = [];
  const diverged: string[] = [];
  const skipped: string[] = [];

  const subs = deps.probe(primaryPath);
  for (const s of subs) {
    const abs = `${primaryPath}/${s.path}`.replace(/\/+/g, "/");
    // Parent gitlink for path
    let gitlink: string;
    try {
      gitlink = deps
        .runGit(["rev-parse", `HEAD:${s.path}`], {
          cwd: primaryPath,
          allowFailure: true,
        })
        .stdout.trim();
      if (!gitlink) {
        skipped.push(s.path);
        continue;
      }
    } catch {
      skipped.push(s.path);
      continue;
    }

    // Prefer origin/main tip, else local main
    let mainTip: string | null = null;
    for (const ref of [`origin/${branch}`, branch]) {
      if (deps.refExists(abs, ref) || deps.refExists(primaryPath, ref)) {
        const r = deps.runGit(["rev-parse", ref], {
          cwd: abs,
          allowFailure: true,
        });
        if (r.status === 0 && r.stdout.trim()) {
          mainTip = r.stdout.trim();
          break;
        }
      }
    }
    if (!mainTip) {
      skipped.push(s.path);
      continue;
    }

    if (mainTip === gitlink) {
      const sw = deps.runGit(["switch", branch], { cwd: abs, allowFailure: true });
      if (sw.status !== 0) {
        // try create tracking
        const swc = deps.runGit(["switch", "-C", branch, gitlink], {
          cwd: abs,
          allowFailure: true,
        });
        if (swc.status !== 0) {
          diverged.push(s.path);
          continue;
        }
      }
      // ensure at pin
      const head = deps.runGit(["rev-parse", "HEAD"], { cwd: abs, allowFailure: true });
      if (head.stdout.trim() !== gitlink) {
        const ff = deps.runGit(["merge", "--ff-only", gitlink], {
          cwd: abs,
          allowFailure: true,
        });
        if (ff.status !== 0) {
          diverged.push(s.path);
          continue;
        }
      }
      attached.push(s.path);
      continue;
    }

    // Safe if mainTip is ancestor of gitlink (can ff main to pin)
    const anc = deps.runGit(["merge-base", "--is-ancestor", mainTip, gitlink], {
      cwd: abs,
      allowFailure: true,
    });
    if (anc.status !== 0) {
      diverged.push(s.path);
      continue;
    }

    const sw = deps.runGit(["switch", branch], { cwd: abs, allowFailure: true });
    if (sw.status !== 0) {
      const swc = deps.runGit(["switch", "-C", branch, mainTip], {
        cwd: abs,
        allowFailure: true,
      });
      if (swc.status !== 0) {
        diverged.push(s.path);
        continue;
      }
    }
    const ff = deps.runGit(["merge", "--ff-only", gitlink], {
      cwd: abs,
      allowFailure: true,
    });
    if (ff.status !== 0) {
      diverged.push(s.path);
      continue;
    }
    attached.push(s.path);
  }

  return { attached, diverged, skipped };
}
