import type { LifecycleStation, NextActionId } from "./edges.js";

/**
 * Default happy-path action for /ops-deliver at a station.
 * Reviews are mandatory at proposed/shipped (skill runs review before apply/merge).
 * Returns null when deliver should stop successfully (done) or cannot advance (unknown).
 */
export function defaultDeliverAction(
  station: LifecycleStation,
): NextActionId | null {
  switch (station) {
    case "no_workspace":
      return "ops-start";
    case "ready_to_propose":
      return "opsx-propose";
    case "proposed":
      // Skill: run spec-review first; if ready, apply in same deliver loop
      return "ops-spec-review";
    case "applied":
      return "ops-ship";
    case "shipped":
      // Skill: run impl-review first; if ready, merge
      return "ops-impl-review";
    case "merged":
      return "opsx-archive";
    case "archived":
      return "ops-finish";
    case "done":
      return "stop";
    case "unknown":
    default:
      return null;
  }
}

/** After a successful mandatory review, the follow-on action before re-detecting station. */
export function deliverActionAfterReview(
  review: "spec" | "impl",
): NextActionId {
  return review === "spec" ? "opsx-apply" : "ops-merge";
}

export const DELIVER_PIPELINE_ORDER: string[] = [
  "start",
  "propose",
  "spec-review",
  "apply",
  "ship",
  "impl-review",
  "merge",
  "archive",
  "finish",
];

/** Max station transitions per deliver invocation (anti-loop). */
export const DELIVER_MAX_STEPS = 20;
