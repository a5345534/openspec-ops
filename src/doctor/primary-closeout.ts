import { join } from "node:path";
import { refExists, resolveBaseRef, revParse, runGit } from "../git.js";
import { toBaseBranchName } from "../commands/ship.js";
import {
  doctorIssuesFromSubmodules,
  probeTopLevelSubmodules,
} from "../submodules/probe.js";
import type { DoctorIssue, SubmoduleStatus } from "../types.js";

export type PrimaryBehindResult = {
  behind: boolean;
  baseBranch: string | null;
  originBaseRef: string | null;
  primaryHead: string | null;
  originHead: string | null;
  reason?: "missing_remote" | "base_unresolved" | "diverged" | "ok" | "error";
};

/**
 * Read-only: primary tip strictly behind origin/<base> (ancestor, non-zero behind).
 * Does not fetch. Fail-open when remote-tracking ref missing.
 */
export function detectPrimaryBehindOrigin(
  primaryPath: string,
  options: {
    remote?: string;
    resolveBase?: (cwd: string) => string;
    revParse?: (cwd: string, rev: string) => string;
    refExists?: (cwd: string, rev: string) => boolean;
    runGit?: typeof runGit;
  } = {},
): PrimaryBehindResult {
  const remote = options.remote ?? "origin";
  const resolveBase = options.resolveBase ?? ((cwd: string) => resolveBaseRef(cwd));
  const rev = options.revParse ?? revParse;
  const exists = options.refExists ?? refExists;
  const git = options.runGit ?? runGit;

  try {
    let baseResolved: string;
    try {
      baseResolved = resolveBase(primaryPath);
    } catch {
      return {
        behind: false,
        baseBranch: null,
        originBaseRef: null,
        primaryHead: null,
        originHead: null,
        reason: "base_unresolved",
      };
    }

    const baseBranch = toBaseBranchName(baseResolved);
    const originBaseRef = `${remote}/${baseBranch}`;
    if (!exists(primaryPath, originBaseRef)) {
      return {
        behind: false,
        baseBranch,
        originBaseRef,
        primaryHead: null,
        originHead: null,
        reason: "missing_remote",
      };
    }

    const primaryHead = rev(primaryPath, "HEAD");
    const originHead = rev(primaryPath, originBaseRef);

    if (primaryHead === originHead) {
      return {
        behind: false,
        baseBranch,
        originBaseRef,
        primaryHead,
        originHead,
        reason: "ok",
      };
    }

    // Strict behind: primary is ancestor of origin/base
    const isAncestor = git(
      ["merge-base", "--is-ancestor", primaryHead, originHead],
      { cwd: primaryPath, allowFailure: true },
    );
    if (isAncestor.status !== 0) {
      return {
        behind: false,
        baseBranch,
        originBaseRef,
        primaryHead,
        originHead,
        reason: "diverged",
      };
    }

    const count = git(["rev-list", "--count", `${primaryHead}..${originHead}`], {
      cwd: primaryPath,
      allowFailure: true,
    });
    const n = count.status === 0 ? Number.parseInt(count.stdout.trim(), 10) : 0;
    const behind = Number.isFinite(n) && n > 0;
    return {
      behind,
      baseBranch,
      originBaseRef,
      primaryHead,
      originHead,
      reason: behind ? "ok" : "ok",
    };
  } catch {
    return {
      behind: false,
      baseBranch: null,
      originBaseRef: null,
      primaryHead: null,
      originHead: null,
      reason: "error",
    };
  }
}

export function primaryBehindDoctorIssue(
  primaryPath: string,
  behind: PrimaryBehindResult,
): DoctorIssue | null {
  if (!behind.behind || !behind.originBaseRef) return null;
  return {
    id: "primary_behind_origin",
    severity: "warning",
    path: primaryPath,
    message: `Primary checkout is behind ${behind.originBaseRef} (local remote-tracking; run git fetch if stale)`,
    hint: `cd ${primaryPath} && git switch ${behind.baseBranch ?? "main"} && git pull --ff-only ${behind.originBaseRef.split("/")[0] ?? "origin"} ${behind.baseBranch ?? "main"}`,
  };
}

/** Map primary submodule probe to primary_* doctor ids (distinct from change-worktree ids). */
export function doctorIssuesFromPrimarySubmodules(
  primaryPath: string,
  submodules: SubmoduleStatus[],
): DoctorIssue[] {
  const linked = doctorIssuesFromSubmodules(primaryPath, submodules);
  return linked.map((issue) => {
    if (issue.id === "submodule_detached_dirty") {
      return {
        ...issue,
        id: "primary_submodule_detached_dirty" as const,
        message: `Primary submodule ${issue.path.replace(primaryPath + "/", "")} is detached HEAD and dirty`,
        hint:
          "Clean or commit inside the submodule, or re-sync pins with git submodule update. Detached-at-gitlink alone is normal after update.",
      };
    }
    return {
      ...issue,
      id: "primary_submodule_detached" as const,
      message: `Primary submodule ${issue.path.replace(primaryPath + "/", "")} is on detached HEAD at gitlink (expected after submodule update)`,
      hint:
        "Detached at parent gitlink is normal Git pin behavior. Optional: finish --attach-submodule-main when main matches pin; do not treat clean detach as deliver failure.",
    };
  });
}

export function collectPrimaryCloseoutDoctorIssues(primaryPath: string): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  try {
    const behind = detectPrimaryBehindOrigin(primaryPath);
    const issue = primaryBehindDoctorIssue(primaryPath, behind);
    if (issue) issues.push(issue);
  } catch {
    // fail-open
  }
  try {
    const subs = probeTopLevelSubmodules(primaryPath);
    for (const issue of doctorIssuesFromPrimarySubmodules(primaryPath, subs)) {
      issues.push(issue);
    }
  } catch {
    // fail-open
  }
  return issues;
}

export function closeoutHintMessages(
  primaryPath: string,
  behind: PrimaryBehindResult,
): string[] {
  const msgs: string[] = [];
  if (behind.behind && behind.originBaseRef) {
    msgs.push(
      `Primary is behind ${behind.originBaseRef}. Lifecycle success ≠ local primary updated. ` +
        `Checklist: git switch ${behind.baseBranch ?? "main"} && git pull --ff-only; ` +
        `git submodule update --init --recursive. Or: finish --sync-primary [--sync-submodules]. ` +
        `See openspec-ops doctor.`,
    );
  }
  return msgs;
}

/** Join helper for tests / messages */
export function primarySubPath(primaryPath: string, rel: string): string {
  return join(primaryPath, rel);
}
