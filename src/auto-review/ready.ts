import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * v1 readiness: openspec/changes/<change>/proposal.md under any root.
 */
export function isProposalReady(
  change: string,
  roots: string[],
): boolean {
  for (const root of roots) {
    if (!root) continue;
    const p = join(root, "openspec", "changes", change, "proposal.md");
    if (existsSync(p)) return true;
  }
  return false;
}

/** Slash entrypoint for follow-up plan/spec review-fix turn (ops-spec-review). */
export const OPS_REVIEW_SLASH = "/ops-spec-review";

export function buildOpsReviewFollowUpMessage(change: string): string {
  return `${OPS_REVIEW_SLASH} ${change}`;
}
