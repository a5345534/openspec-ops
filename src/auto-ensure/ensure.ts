import { runOps, type OpsJsonEnvelope, type RunOpsResult } from "./run-ops.js";
import type { AutoStartPolicy } from "./policy.js";

export type EnsureOutcome =
  | {
      status: "ok";
      change: string;
      path: string;
      branch: string;
      action: "reused" | "created" | "already_present";
    }
  | { status: "skipped"; reason: "policy_off" | "user_declined" | "no_change_name" }
  | {
      status: "error";
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };

export interface EnsureDeps {
  bin: string;
  cwd?: string;
  policy: AutoStartPolicy;
  /** Only used when policy is ask and worktree is missing. */
  confirmCreate?: (change: string) => Promise<boolean> | boolean;
  run?: (bin: string, args: string[], cwd?: string) => RunOpsResult;
}

function errFromResult(r: RunOpsResult, fallbackCode: string): EnsureOutcome {
  const code = r.json?.error?.code ?? fallbackCode;
  const message =
    r.json?.error?.message ??
    (r.stderr.trim() || r.stdout.trim() || `openspec-ops failed (exit ${r.code})`);
  return {
    status: "error",
    code,
    message,
    details: r.json?.error?.details,
  };
}

function pathFromWhere(json: OpsJsonEnvelope | undefined): {
  path: string;
  branch: string;
} | null {
  const result = json?.result;
  if (!result || typeof result.path !== "string") return null;
  return {
    path: result.path,
    branch: typeof result.branch === "string" ? result.branch : "",
  };
}

/**
 * where → start when needed. Never uses raw git worktree.
 */
export async function ensureWorkspace(
  change: string,
  deps: EnsureDeps,
): Promise<EnsureOutcome> {
  if (deps.policy === "off") {
    return { status: "skipped", reason: "policy_off" };
  }

  const run = deps.run ?? ((bin, args, cwd) => runOps(bin, args, { cwd }));

  const where = run(deps.bin, ["where", change, "--json"], deps.cwd);
  if (where.code === 0 && where.json?.ok) {
    const loc = pathFromWhere(where.json);
    if (loc) {
      return {
        status: "ok",
        change,
        path: loc.path,
        branch: loc.branch,
        action: "already_present",
      };
    }
  }

  // not found or unexpected where failure
  if (where.code !== 5 && where.code !== 0) {
    // where failed for environment reasons
    if (where.code === 2 || where.code === 10 || where.code === 1) {
      return errFromResult(where, "where_failed");
    }
  }

  if (deps.policy === "ask") {
    const ok = deps.confirmCreate ? await deps.confirmCreate(change) : false;
    if (!ok) {
      return { status: "skipped", reason: "user_declined" };
    }
  }

  const start = run(deps.bin, ["start", change, "--json"], deps.cwd);
  if (start.code !== 0 || !start.json?.ok) {
    return errFromResult(start, "start_failed");
  }

  const result = start.json.result ?? {};
  const path = typeof result.path === "string" ? result.path : "";
  const branch = typeof result.branch === "string" ? result.branch : change;
  const action = result.action === "reused" ? "reused" : "created";

  if (!path) {
    return {
      status: "error",
      code: "internal",
      message: "start succeeded but result.path missing",
    };
  }

  return { status: "ok", change, path, branch, action };
}
