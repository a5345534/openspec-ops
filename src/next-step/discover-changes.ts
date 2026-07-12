import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { CHANGE_NAME_RE } from "../ops-runtime/change-name.js";
import { inferChangeFromLeaf } from "../resolve.js";

/**
 * List candidate kebab change names for nameless `/ops-next`.
 * - Active openspec/changes/<kebab>/ under roots (skip archive/)
 * - Leaf names under <root>/.worktrees/<leaf> when kebab / inferable
 */
export function listCandidateChanges(roots: string[]): string[] {
  const found = new Set<string>();

  for (const root of roots) {
    if (!root || !existsSync(root)) continue;

    const changesDir = join(root, "openspec", "changes");
    if (existsSync(changesDir)) {
      try {
        for (const ent of readdirSync(changesDir)) {
          if (ent === "archive") continue;
          if (!CHANGE_NAME_RE.test(ent)) continue;
          const full = join(changesDir, ent);
          try {
            if (statSync(full).isDirectory()) found.add(ent);
          } catch {
            // skip
          }
        }
      } catch {
        // skip
      }
    }

    const wtRoot = join(root, ".worktrees");
    if (existsSync(wtRoot)) {
      try {
        for (const leaf of readdirSync(wtRoot)) {
          const full = join(wtRoot, leaf);
          try {
            if (!statSync(full).isDirectory()) continue;
          } catch {
            continue;
          }
          if (CHANGE_NAME_RE.test(leaf)) {
            found.add(leaf);
            continue;
          }
          const inferred = inferChangeFromLeaf(leaf);
          if (inferred && CHANGE_NAME_RE.test(inferred)) {
            found.add(inferred);
          }
        }
      } catch {
        // skip
      }
    }

    // cwd itself might be a worktree leaf
    const leaf = basename(root);
    if (CHANGE_NAME_RE.test(leaf)) {
      found.add(leaf);
    } else {
      const inferred = inferChangeFromLeaf(leaf);
      if (inferred && CHANGE_NAME_RE.test(inferred)) found.add(inferred);
    }
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

/** Text list for headless multi-candidate pick (no auto-select). */
export function formatChangePickList(candidates: string[]): string {
  const lines = [
    "Multiple changes available. Re-run with a name:",
    "",
    ...candidates.map((c, i) => `${i + 1}. /ops-next ${c}`),
    "",
    "Nothing was auto-selected.",
  ];
  return lines.join("\n");
}
