import { existsSync } from "node:fs";
import { join } from "node:path";
import { detectSpecReviewPhase } from "../lifecycle/phase.js";
import { areAllTasksComplete } from "./tasks-checkboxes.js";

/**
 * Raw proposal presence: openspec/changes/<change>/proposal.md under any root.
 */
export function isProposalReady(change: string, roots: string[]): boolean {
  for (const root of roots) {
    if (!root) continue;
    const p = join(root, "openspec", "changes", change, "proposal.md");
    if (existsSync(p)) return true;
  }
  return false;
}

/**
 * Auto-review schedule eligibility (pre-apply candidate).
 *
 * - Requires proposal.md
 * - Excludes when lifecycle phase is archived or active_and_archived
 * - Excludes when tasks.md has checkboxes and none are open (all complete)
 * - Missing tasks.md or no checkboxes → still eligible if proposal present
 */
export function isAutoReviewEligible(change: string, roots: string[]): boolean {
  if (!isProposalReady(change, roots)) return false;

  const phase = detectSpecReviewPhase(change, roots).phase;
  if (phase === "archived" || phase === "active_and_archived") {
    return false;
  }

  if (areAllTasksComplete(change, roots)) {
    return false;
  }

  return true;
}

/** Slash entrypoint for follow-up plan/spec review-fix turn (ops-spec-review). */
export const OPS_REVIEW_SLASH = "/ops-spec-review";

export function buildOpsReviewFollowUpMessage(change: string): string {
  return `${OPS_REVIEW_SLASH} ${change}`;
}
