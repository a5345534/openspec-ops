import { runOps, type RunOpsResult } from "../auto-ensure/run-ops.js";
import {
  decideOrphanGate,
  parseWhereSnapshot,
  type OrphanDecision,
} from "./orphan-gate.js";
import type { AutoFinishPolicy } from "./policy.js";

export type EvaluateDeps = {
  bin: string;
  cwd?: string;
  policy: AutoFinishPolicy;
  hasUI: boolean;
  run?: typeof runOps;
  /** Called only when decision is confirm_finish */
  confirmFinish?: (change: string, path: string, branch: string) => Promise<boolean> | boolean;
};

export type EvaluateOutcome =
  | { kind: "decision"; change: string; decision: OrphanDecision }
  | {
      kind: "finished";
      change: string;
      path: string;
      branch: string;
      forced: boolean;
    }
  | {
      kind: "finish_error";
      change: string;
      code: string;
      message: string;
    }
  | {
      kind: "declined";
      change: string;
    };

/**
 * where → orphan decision → optional confirm → finish (no --force).
 * Does not mutate a watch set; caller applies keep/clear from outcome.
 */
export async function evaluateWatchedChange(
  change: string,
  deps: EvaluateDeps,
): Promise<EvaluateOutcome> {
  const run = deps.run ?? runOps;
  const whereRes: RunOpsResult = run(deps.bin, ["where", change], { cwd: deps.cwd });
  const where = parseWhereSnapshot(change, whereRes);
  let decision = decideOrphanGate({
    where,
    policy: deps.policy,
    hasUI: deps.hasUI,
  });

  if (decision.action === "confirm_finish") {
    const ok = deps.confirmFinish
      ? await deps.confirmFinish(decision.change, decision.path, decision.branch)
      : false;
    if (!ok) {
      return { kind: "declined", change };
    }
    decision = {
      action: "finish_now",
      change: decision.change,
      path: decision.path,
      branch: decision.branch,
    };
  }

  if (decision.action !== "finish_now") {
    return { kind: "decision", change, decision };
  }

  const finishRes = run(deps.bin, ["finish", change], { cwd: deps.cwd });
  if (finishRes.code === 0 && finishRes.json?.ok !== false) {
    const r = finishRes.json?.result ?? {};
    return {
      kind: "finished",
      change,
      path: String(r.path ?? decision.path),
      branch: String(r.branch ?? decision.branch),
      forced: Boolean(r.forced),
    };
  }

  return {
    kind: "finish_error",
    change,
    code: finishRes.json?.error?.code ?? `exit_${finishRes.code}`,
    message: finishRes.json?.error?.message ?? "openspec-ops finish failed",
  };
}
