import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { CHANGE_NAME_RE } from "../auto-ensure/parse.js";
import { isAutoReviewEligible, isProposalReady } from "./ready.js";

/**
 * List kebab change names under openspec/changes that are auto-review eligible
 * (proposal + pre-apply: not all tasks complete, phase ok).
 */
export function discoverReadyProposalChanges(roots: string[]): string[] {
  const found = new Set<string>();
  for (const root of roots) {
    if (!root) continue;
    const changesDir = join(root, "openspec", "changes");
    if (!existsSync(changesDir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(changesDir);
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (ent === "archive") continue;
      if (!CHANGE_NAME_RE.test(ent)) continue;
      const dir = join(changesDir, ent);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      // proposal under this root first; full eligibility uses all roots
      if (!isProposalReady(ent, [root])) continue;
      if (isAutoReviewEligible(ent, roots)) {
        found.add(ent);
      }
    }
  }
  return [...found].sort();
}

/**
 * Given ready names and already-scheduled set, return names to fire (one-shot).
 */
export function selectReviewFollowUps(
  readyNames: string[],
  alreadyScheduled: ReadonlySet<string>,
): string[] {
  return readyNames.filter((n) => !alreadyScheduled.has(n));
}
