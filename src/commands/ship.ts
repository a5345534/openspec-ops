import { runGit, isDirty, resolveBaseRef, revParse } from "../git.js";
import { probeTopLevelSubmodules } from "../submodules/probe.js";
import { resolvePrBackend } from "../ship/backends/gh.js";
import type { PrBackend } from "../ship/pr-backend.js";
import { printSuccess } from "../output.js";
import { CliError, type ShipOptions, type ShipResult } from "../types.js";
import { locateWorkspace } from "./where.js";

export function defaultShipMessage(change: string): string {
  return `ship(${change}): worktree`;
}

/** Heuristic: gh/backend says there is no commit range / nothing to open as a new PR. */
export function isNothingToShipMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("no commits") ||
    m.includes("already up-to-date") ||
    m.includes("already up to date") ||
    m.includes("nothing to compare") ||
    m.includes("no changes between") ||
    m.includes("head branch contains no commits")
  );
}

/** Strip remote prefix for gh --base (origin/main → main). */
export function toBaseBranchName(ref: string): string {
  return ref
    .replace(/^refs\/remotes\//, "")
    .replace(/^origin\//, "")
    .replace(/^refs\/heads\//, "");
}

export function resolveRemotePushUrl(cwd: string, remote: string): string {
  const result = runGit(["remote", "get-url", "--push", remote], {
    cwd,
    allowFailure: true,
  });
  const url = result.stdout.trim();
  if (result.status !== 0 || !url) {
    throw new CliError(
      "remote_not_configured",
      `Remote '${remote}' is not configured with a usable push URL.`,
      {
        remote,
        suggestedAction: "configure_remote_or_create_repository",
      },
    );
  }
  return url;
}

export function classifyPushFailure(message: string):
  | "push_auth_failed"
  | "push_rejected"
  | "push_failed" {
  const value = message.toLowerCase();
  if (
    value.includes("authentication failed") ||
    value.includes("permission denied") ||
    value.includes("could not read username") ||
    value.includes("publickey") ||
    value.includes("access denied") ||
    value.includes("write access to repository not granted") ||
    value.includes("does not have write access") ||
    value.includes("error: 401") ||
    value.includes("error: 403") ||
    value.includes("repository not found")
  ) {
    return "push_auth_failed";
  }
  if (
    value.includes("[rejected]") ||
    value.includes("non-fast-forward") ||
    value.includes("protected branch") ||
    value.includes("pre-receive hook declined") ||
    value.includes("remote rejected") ||
    value.includes("failed to push some refs")
  ) {
    return "push_rejected";
  }
  return "push_failed";
}

export interface ShipDeps {
  locate: typeof locateWorkspace;
  isDirty: (path: string) => boolean;
  probe: typeof probeTopLevelSubmodules;
  resolveBase: (cwd: string, explicit?: string) => string;
  revParse: (cwd: string, rev: string) => string;
  stageAllAndCommit: (cwd: string, message: string) => string;
  getRemotePushUrl: (cwd: string, remote: string) => string;
  branchAheadOfRemote: (cwd: string, remote: string, branch: string) => boolean;
  pushBranch: (cwd: string, remote: string, branch: string) => void;
  getPrBackend: (id: string) => PrBackend;
}

const defaultDeps: ShipDeps = {
  locate: locateWorkspace,
  isDirty,
  probe: probeTopLevelSubmodules,
  resolveBase: resolveBaseRef,
  revParse,
  stageAllAndCommit(cwd, message) {
    runGit(["add", "-A"], { cwd });
    runGit(["commit", "-m", message], { cwd });
    return revParse(cwd, "HEAD");
  },
  getRemotePushUrl: resolveRemotePushUrl,
  branchAheadOfRemote(cwd, remote, branch) {
    const remoteRef = `${remote}/${branch}`;
    const hasRemote = runGit(["rev-parse", "--verify", "--quiet", remoteRef], {
      cwd,
      allowFailure: true,
    });
    if (hasRemote.status !== 0) {
      // No remote branch yet → treat as ahead (need push)
      return true;
    }
    const count = runGit(["rev-list", "--count", `${remoteRef}..HEAD`], {
      cwd,
      allowFailure: true,
    });
    if (count.status !== 0) return true;
    return Number.parseInt(count.stdout.trim() || "0", 10) > 0;
  },
  pushBranch(cwd, remote, branch) {
    // Never --force
    runGit(["push", "-u", remote, branch], { cwd });
  },
  getPrBackend: resolvePrBackend,
};

export function runShip(options: ShipOptions, deps: ShipDeps = defaultDeps): ShipResult {
  const loc = deps.locate(options);
  const remote = options.remote || "origin";
  const backendId = options.backend || "gh";
  const warnings: ShipResult["warnings"] = [];

  const subs = deps.probe(loc.path);
  for (const s of subs) {
    if (s.detached && s.dirty) {
      throw new CliError(
        "submodule_detached_dirty",
        `Submodule ${s.path} is detached HEAD and dirty. Commit in the submodule first, then re-run ship.`,
        { path: s.path, change: loc.change },
      );
    }
    if (s.detached && !s.dirty) {
      warnings.push({
        code: "submodule_detached",
        message: `Submodule ${s.path} is on detached HEAD (clean); continuing ship`,
      });
    }
  }

  let backend: PrBackend;
  try {
    const remoteUrl = deps.getRemotePushUrl(loc.path, remote);
    backend = deps.getPrBackend(backendId);
    backend.preflightRepository({ cwd: loc.path, remote, remoteUrl });
  } catch (err) {
    if (err instanceof CliError) {
      throw new CliError(err.code, err.message, {
        ...err.details,
        remote,
        branch: loc.branch,
        commitCreated: false,
        commitSha: null,
        pushOk: false,
      });
    }
    throw new CliError(
      "internal",
      err instanceof Error ? err.message : String(err),
      {
        remote,
        branch: loc.branch,
        commitCreated: false,
        commitSha: null,
        pushOk: false,
      },
    );
  }

  const message = options.message?.trim() || defaultShipMessage(loc.change);
  const title = options.title?.trim() || message;
  const body = options.body ?? "";

  let commitCreated = false;
  let commitSha: string | null = null;
  let commitMessage: string | null = null;

  const dirty = deps.isDirty(loc.path);
  if (dirty) {
    commitSha = deps.stageAllAndCommit(loc.path, message);
    commitCreated = true;
    commitMessage = message;
  } else {
    commitSha = deps.revParse(loc.path, "HEAD");
  }

  const ahead = deps.branchAheadOfRemote(loc.path, remote, loc.branch);
  let pushed = false;
  let pushSkipped = false;

  if (ahead || dirty || commitCreated) {
    try {
      deps.pushBranch(loc.path, remote, loc.branch);
      pushed = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CliError(classifyPushFailure(message), message, {
        remote,
        branch: loc.branch,
        commitCreated,
        commitSha,
        pushOk: false,
      });
    }
  } else {
    pushSkipped = true;
  }

  const baseRef = options.base
    ? options.base
    : toBaseBranchName(deps.resolveBase(loc.primaryPath));
  const base = toBaseBranchName(baseRef);

  let pr: ShipResult["pr"] = null;
  try {
    const prRes = backend.createOrReusePullRequest({
      cwd: loc.path,
      base,
      head: loc.branch,
      title,
      body,
      draft: options.draft,
    });
    pr = {
      url: prRes.url,
      number: prRes.number,
      backend: backend.id,
      draft: options.draft,
      alreadyExisted: prRes.alreadyExisted,
    };
  } catch (err) {
    if (err instanceof CliError) {
      // Clean + not ahead + no PR work left → nothing_to_ship (stable state code)
      if (
        err.code === "pr_failed" &&
        !commitCreated &&
        pushSkipped &&
        isNothingToShipMessage(err.message)
      ) {
        throw new CliError(
          "nothing_to_ship",
          `Nothing to ship for '${loc.change}': clean worktree, not ahead of ${remote}/${loc.branch}, and no PR to create (${err.message})`,
          { change: loc.change, branch: loc.branch, cause: err.message },
        );
      }
      if (err.code === "pr_failed" || err.code === "pr_backend_unavailable") {
        throw new CliError(err.code, err.message, {
          ...err.details,
          pushOk: pushed,
          hint:
            (err.details.hint as string | undefined) ??
            (pushed
              ? "Push may have succeeded; re-run ship after fixing PR backend (clean worktree → no new commit)."
              : undefined),
        });
      }
      throw err;
    }
    throw new CliError("pr_failed", err instanceof Error ? err.message : String(err), {
      pushOk: pushed,
    });
  }

  if (!pr) {
    throw new CliError(
      "nothing_to_ship",
      `Nothing to ship for '${loc.change}': clean worktree, branch not ahead of ${remote}/${loc.branch}, no PR`,
      { change: loc.change, branch: loc.branch },
    );
  }

  let action: ShipResult["action"] = "shipped";
  if (pr?.alreadyExisted && !commitCreated && pushSkipped) {
    action = "pr_exists";
  } else if (!commitCreated && pushed) {
    action = "pushed";
  } else if (!commitCreated && pushSkipped && pr) {
    action = pr.alreadyExisted ? "pr_exists" : "pr_only";
  } else if (commitCreated) {
    action = "shipped";
  }

  const result: ShipResult = {
    action,
    change: loc.change,
    path: loc.path,
    branch: loc.branch,
    remote,
    base,
    commit: {
      created: commitCreated,
      sha: commitSha,
      message: commitMessage,
    },
    push: { ok: pushed || pushSkipped, skipped: pushSkipped },
    pr,
    warnings,
  };

  printSuccess("ship", result, {
    json: options.json,
    humanLines: [
      `action:  ${result.action}`,
      `change:  ${result.change}`,
      `branch:  ${result.branch}`,
      `commit:  ${commitCreated ? commitSha : "(none created)"}`,
      `push:    ${pushSkipped ? "skipped" : pushed ? "ok" : "no"}`,
      `pr:      ${pr ? `${pr.url}` : "(none)"}`,
      ...warnings.map((w) => `warn:    ${w.message}`),
    ],
  });

  return result;
}
