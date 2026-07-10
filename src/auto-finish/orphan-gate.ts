import type { AutoFinishPolicy } from "./policy.js";

/** Minimal where snapshot for orphan decisions (from CLI JSON result). */
export type WhereSnapshot =
  | { status: "not_found" }
  | { status: "error"; code: string; message: string }
  | {
      status: "found";
      change: string;
      path: string;
      branch: string;
      dirty: boolean;
      changeDirExists: boolean;
    };

export type OrphanDecision =
  | { action: "keep_watch" }
  | { action: "clear_skip"; reason: "not_found" | "ask_declined" | "ask_no_ui" }
  | { action: "notify_dirty_clear" }
  | { action: "notify_where_error"; code: string; message: string }
  | {
      action: "confirm_finish";
      change: string;
      path: string;
      branch: string;
    }
  | {
      action: "finish_now";
      change: string;
      path: string;
      branch: string;
    };

/**
 * Pure decision for a watched change after where (+ policy / UI).
 *
 * Orphan hard conditions: where found, !dirty, changeDirExists === false.
 * policy `off` is handled by the caller (do not evaluate).
 */
export function decideOrphanGate(input: {
  where: WhereSnapshot;
  policy: AutoFinishPolicy;
  hasUI: boolean;
}): OrphanDecision {
  const { where, policy, hasUI } = input;

  if (where.status === "error") {
    return {
      action: "notify_where_error",
      code: where.code,
      message: where.message,
    };
  }

  if (where.status === "not_found") {
    return { action: "clear_skip", reason: "not_found" };
  }

  // Still active OpenSpec change → sticky watch, no finish
  if (where.changeDirExists) {
    return { action: "keep_watch" };
  }

  // Inactive but dirty → never auto finish / never --force
  if (where.dirty) {
    return { action: "notify_dirty_clear" };
  }

  // Orphan hard conditions hold (found, !dirty, !changeDirExists)
  if (policy === "on") {
    return {
      action: "finish_now",
      change: where.change,
      path: where.path,
      branch: where.branch,
    };
  }

  // policy ask (default)
  if (!hasUI) {
    return { action: "clear_skip", reason: "ask_no_ui" };
  }

  return {
    action: "confirm_finish",
    change: where.change,
    path: where.path,
    branch: where.branch,
  };
}

export function parseWhereSnapshot(
  change: string,
  whereResult: {
    code: number;
    json?: {
      ok?: boolean;
      result?: Record<string, unknown>;
      error?: { code?: string; message?: string };
    };
  },
): WhereSnapshot {
  if (whereResult.code === 5 || whereResult.json?.error?.code === "not_found") {
    return { status: "not_found" };
  }
  if (whereResult.code !== 0 || !whereResult.json?.ok || !whereResult.json.result) {
    const code =
      whereResult.json?.error?.code ??
      (whereResult.code === 0 ? "invalid_json" : `exit_${whereResult.code}`);
    const message =
      whereResult.json?.error?.message ?? "openspec-ops where failed";
    return { status: "error", code, message };
  }
  const r = whereResult.json.result;
  return {
    status: "found",
    change: typeof r.change === "string" ? r.change : change,
    path: String(r.path ?? ""),
    branch: String(r.branch ?? change),
    dirty: Boolean(r.dirty),
    changeDirExists: Boolean(r.changeDirExists),
  };
}
