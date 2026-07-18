import { isDirty, refExists, resolveBaseRef, revParse, runGit } from "../git.js";
import { toBaseBranchName } from "./ship.js";
import { probeTopLevelSubmodules } from "../submodules/probe.js";
import {
  CliError,
  type ReturnToMainSubmoduleState,
} from "../types.js";
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

export type ReturnToMainResult = {
  primary: { branch: string; head: string; remoteHead: string };
  submodules: ReturnToMainSubmoduleState[];
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

  const fetch = deps.runGit(["fetch", "--prune", remote], {
    cwd: primaryPath,
    allowFailure: true,
  });
  if (fetch.status !== 0) {
    throw new CliError(
      "sync_primary_failed",
      `Cannot --sync-primary: fetch ${remote} failed: ${fetch.stderr || fetch.stdout}`,
      { ...detailsBase, originBase },
    );
  }

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
    let sw = deps.runGit(["switch", baseBranch], {
      cwd: primaryPath,
      allowFailure: true,
    });
    if (sw.status !== 0 && !deps.refExists(primaryPath, `refs/heads/${baseBranch}`)) {
      sw = deps.runGit(
        ["switch", "-c", baseBranch, "--track", originBase],
        { cwd: primaryPath, allowFailure: true },
      );
    }
    if (sw.status !== 0) {
      throw new CliError(
        "sync_primary_failed",
        `Cannot --sync-primary: failed to switch to ${baseBranch}: ${sw.stderr || sw.stdout}`,
        { ...detailsBase, baseBranch, originBase },
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

function gitText(
  deps: FinishSyncDeps,
  cwd: string,
  args: string[],
): string | null {
  const result = deps.runGit(args, { cwd, allowFailure: true });
  return result.status === 0 && result.stdout.trim()
    ? result.stdout.trim()
    : null;
}

function currentBranch(deps: FinishSyncDeps, cwd: string): string | null {
  return gitText(deps, cwd, ["branch", "--show-current"]);
}

function submodulePaths(deps: FinishSyncDeps, cwd: string): string[] {
  const result = deps.runGit(
    ["config", "-z", "--file", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"],
    { cwd, allowFailure: true },
  );
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split("\0")
    .map((entry) => entry.trim().split(/\n|\s+/).at(-1) ?? "")
    .filter(Boolean);
}

type SubmoduleInventory = {
  path: string;
  abs: string;
  parent: string;
  parentPath: string;
};

function inventorySubmodules(
  primaryPath: string,
  deps: FinishSyncDeps,
): SubmoduleInventory[] {
  const rows: SubmoduleInventory[] = [];
  const visited = new Set<string>();
  const walk = (parent: string, prefix: string, depth: number): void => {
    if (depth > 32) return;
    for (const parentPath of submodulePaths(deps, parent)) {
      const abs = `${parent}/${parentPath}`.replace(/\/+/, "/");
      const path = prefix ? `${prefix}/${parentPath}` : parentPath;
      const initialized = deps.runGit(
        ["rev-parse", "--is-inside-work-tree"],
        { cwd: abs, allowFailure: true },
      );
      if (initialized.status !== 0 || visited.has(abs)) continue;
      visited.add(abs);
      rows.push({ path, abs, parent, parentPath });
      walk(abs, path, depth + 1);
    }
  };
  walk(primaryPath, "", 0);
  return rows;
}

function resolveRemoteDefault(
  cwd: string,
  remote: string,
  deps: FinishSyncDeps,
): { branch: string; ref: string } | null {
  const read = (): string | null =>
    gitText(deps, cwd, ["symbolic-ref", "--quiet", `refs/remotes/${remote}/HEAD`]);
  let symbolic = read();
  if (!symbolic) {
    deps.runGit(["remote", "set-head", remote, "--auto"], {
      cwd,
      allowFailure: true,
    });
    symbolic = read();
  }
  const prefix = `refs/remotes/${remote}/`;
  if (!symbolic?.startsWith(prefix)) return null;
  const branch = symbolic.slice(prefix.length);
  return branch ? { branch, ref: `${remote}/${branch}` } : null;
}

function failureState(
  row: SubmoduleInventory,
  outcome: ReturnToMainSubmoduleState["attachOutcome"],
  values: Partial<ReturnToMainSubmoduleState> = {},
): ReturnToMainSubmoduleState {
  return {
    path: row.path,
    branch: values.branch ?? null,
    head: values.head ?? null,
    gitlink: values.gitlink ?? null,
    remoteDefaultBranch: values.remoteDefaultBranch ?? null,
    attachOutcome: outcome,
  };
}

export function preflightReturnToMain(
  primaryPath: string,
  deps: FinishSyncDeps = defaultFinishSyncDeps,
): { primaryDirty: boolean; submodules: ReturnToMainSubmoduleState[] } {
  const direct = deps.runGit(
    ["status", "--porcelain", "--ignore-submodules=all"],
    { cwd: primaryPath, allowFailure: true },
  );
  const primaryDirty = direct.status !== 0 || Boolean(direct.stdout.trim());
  const submodules = inventorySubmodules(primaryPath, deps)
    .filter((row) => deps.isDirty(row.abs))
    .map((row) => failureState(row, "dirty", {
      branch: currentBranch(deps, row.abs),
      head: gitText(deps, row.abs, ["rev-parse", "HEAD"]),
      gitlink: gitText(deps, row.parent, ["rev-parse", `HEAD:${row.parentPath}`]),
    }));
  return { primaryDirty, submodules };
}

/** Strict, recursive, non-destructive return-to-main closeout. */
export function returnPrimaryAndSubmodulesToMain(
  primaryPath: string,
  options: { remote?: string; worktreeRemoved?: boolean } = {},
  deps: FinishSyncDeps = defaultFinishSyncDeps,
): ReturnToMainResult {
  const remote = options.remote ?? "origin";
  const initial = preflightReturnToMain(primaryPath, deps);
  if (initial.primaryDirty || initial.submodules.length > 0) {
    throw new CliError(
      "return_to_main_needs_human",
      "Strict return-to-main requires clean primary and initialized submodules.",
      {
        primary: null,
        submodules: initial.submodules,
        primaryDirty: initial.primaryDirty,
        worktreeRemoved: Boolean(options.worktreeRemoved),
      },
    );
  }
  const primary = syncPrimaryCheckout(primaryPath, options, deps);
  const remoteHead = deps.revParse(primaryPath, `${remote}/${primary.baseBranch}`);
  if (primary.head !== remoteHead) {
    throw new CliError(
      "return_to_main_needs_human",
      `Primary HEAD does not equal ${remote}/${primary.baseBranch} after ff-only sync.`,
      {
        primary: { branch: primary.baseBranch, head: primary.head, remoteHead },
        submodules: [],
        worktreeRemoved: Boolean(options.worktreeRemoved),
      },
    );
  }

  const preflight = preflightReturnToMain(primaryPath, deps);
  if (preflight.primaryDirty || preflight.submodules.length > 0) {
    throw new CliError(
      "return_to_main_needs_human",
      "Strict return-to-main requires clean primary and initialized submodules.",
      {
        primary: { branch: primary.baseBranch, head: primary.head, remoteHead },
        submodules: preflight.submodules,
        primaryDirty: preflight.primaryDirty,
        worktreeRemoved: Boolean(options.worktreeRemoved),
      },
    );
  }

  syncPrimarySubmodules(primaryPath, options, deps);
  const states: ReturnToMainSubmoduleState[] = [];
  for (const row of inventorySubmodules(primaryPath, deps)) {
    const gitlink = gitText(deps, row.parent, ["rev-parse", `HEAD:${row.parentPath}`]);
    const head = gitText(deps, row.abs, ["rev-parse", "HEAD"]);
    const branch = currentBranch(deps, row.abs);
    if (!gitlink) {
      states.push(failureState(row, "gitlink_unresolved", { head, branch }));
      continue;
    }
    if (deps.isDirty(row.abs)) {
      states.push(failureState(row, "dirty", { head, branch, gitlink }));
      continue;
    }
    const fetch = deps.runGit(["fetch", "--prune", remote], {
      cwd: row.abs,
      allowFailure: true,
    });
    if (fetch.status !== 0) {
      states.push(failureState(row, "fetch_failed", { head, branch, gitlink }));
      continue;
    }
    const defaultRef = resolveRemoteDefault(row.abs, remote, deps);
    if (!defaultRef) {
      states.push(failureState(row, "default_unresolved", { head, branch, gitlink }));
      continue;
    }
    const common = {
      gitlink,
      remoteDefaultBranch: defaultRef.branch,
    };
    const remoteTip = gitText(deps, row.abs, ["rev-parse", defaultRef.ref]);
    if (!remoteTip) {
      states.push(failureState(row, "default_unresolved", { head, branch, ...common }));
      continue;
    }
    if (remoteTip !== gitlink) {
      const ancestor = deps.runGit(
        ["merge-base", "--is-ancestor", remoteTip, gitlink],
        { cwd: row.abs, allowFailure: true },
      );
      if (ancestor.status !== 0) {
        states.push(failureState(row, "incompatible_default", { head, branch, ...common }));
        continue;
      }
    }

    const localRef = `refs/heads/${defaultRef.branch}`;
    const localExists = deps.refExists(row.abs, localRef);
    if (localExists) {
      const localTip = gitText(deps, row.abs, ["rev-parse", localRef]);
      if (!localTip) {
        states.push(failureState(row, "incompatible_local_branch", { head, branch, ...common }));
        continue;
      }
      if (localTip !== gitlink) {
        const ancestor = deps.runGit(
          ["merge-base", "--is-ancestor", localTip, gitlink],
          { cwd: row.abs, allowFailure: true },
        );
        if (ancestor.status !== 0) {
          states.push(failureState(row, "incompatible_local_branch", { head, branch, ...common }));
          continue;
        }
      }
    }

    const restorePin = (): { head: string | null; branch: string | null } => {
      deps.runGit(["switch", "--detach", gitlink], {
        cwd: row.abs,
        allowFailure: true,
      });
      return {
        head: gitText(deps, row.abs, ["rev-parse", "HEAD"]),
        branch: currentBranch(deps, row.abs),
      };
    };
    const switched = deps.runGit(
      localExists
        ? ["switch", defaultRef.branch]
        : ["switch", "-c", defaultRef.branch, "--track", defaultRef.ref],
      { cwd: row.abs, allowFailure: true },
    );
    if (switched.status !== 0) {
      states.push(failureState(row, "switch_failed", { ...restorePin(), ...common }));
      continue;
    }
    const afterSwitch = gitText(deps, row.abs, ["rev-parse", "HEAD"]);
    if (afterSwitch !== gitlink) {
      const ff = deps.runGit(["merge", "--ff-only", gitlink], {
        cwd: row.abs,
        allowFailure: true,
      });
      if (ff.status !== 0) {
        states.push(failureState(row, "fast_forward_failed", {
          ...restorePin(),
          ...common,
        }));
        continue;
      }
    }
    const finalHead = gitText(deps, row.abs, ["rev-parse", "HEAD"]);
    const finalBranch = currentBranch(deps, row.abs);
    if (finalHead !== gitlink || finalBranch !== defaultRef.branch) {
      states.push(failureState(row, "verification_failed", {
        ...restorePin(),
        ...common,
      }));
      continue;
    }
    states.push(failureState(row, "attached", {
      head: finalHead,
      branch: finalBranch,
      ...common,
    }));
  }

  const snapshot = {
    primary: { branch: primary.baseBranch, head: primary.head, remoteHead },
    submodules: states,
  };
  const incompatible = states.filter((state) => state.attachOutcome !== "attached");
  if (incompatible.length > 0 || deps.isDirty(primaryPath)) {
    throw new CliError(
      "return_to_main_needs_human",
      "Strict return-to-main could not safely attach every initialized submodule at its parent gitlink.",
      {
        ...snapshot,
        worktreeRemoved: Boolean(options.worktreeRemoved),
        primaryDirty: deps.isDirty(primaryPath),
      },
    );
  }
  return snapshot;
}
