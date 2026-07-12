import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { CHANGE_NAME_RE } from "../ops-runtime/change-name.js";
import { inferChangeFromLeaf } from "../resolve.js";

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** If dir is `.../.worktrees/<leaf>`, return kebab change name; else null. */
export function worktreeLeafChangeName(dir: string): string | null {
  if (!dir) return null;
  const parent = basename(dirname(dir));
  if (parent !== ".worktrees") return null;
  const leaf = basename(dir);
  if (CHANGE_NAME_RE.test(leaf)) return leaf;
  const inferred = inferChangeFromLeaf(leaf);
  if (inferred && CHANGE_NAME_RE.test(inferred)) return inferred;
  return null;
}

function addKebabName(found: Set<string>, name: string | null | undefined): void {
  if (name && CHANGE_NAME_RE.test(name)) found.add(name);
}

/**
 * List candidate kebab change names for nameless `/ops-next`.
 * - Active openspec/changes/<kebab>/ under roots (skip archive/)
 * - Dirs under <root>/.worktrees/<kebab>/
 * - If root itself is .../.worktrees/<kebab>, include that leaf
 * - Does NOT treat package/repo root basename as a change
 */
export function listCandidateChanges(roots: string[]): string[] {
  const found = new Set<string>();

  for (const root of roots) {
    if (!root || !existsSync(root)) continue;

    const changesDir = join(root, "openspec", "changes");
    if (existsSync(changesDir) && isDir(changesDir)) {
      try {
        for (const ent of readdirSync(changesDir)) {
          if (ent === "archive") continue;
          if (!CHANGE_NAME_RE.test(ent)) continue;
          const full = join(changesDir, ent);
          if (isDir(full)) found.add(ent);
        }
      } catch {
        // skip
      }
    }

    const wtRoot = join(root, ".worktrees");
    if (existsSync(wtRoot) && isDir(wtRoot)) {
      try {
        for (const leaf of readdirSync(wtRoot)) {
          const full = join(wtRoot, leaf);
          if (!isDir(full)) continue;
          if (CHANGE_NAME_RE.test(leaf)) {
            found.add(leaf);
            continue;
          }
          addKebabName(found, inferChangeFromLeaf(leaf));
        }
      } catch {
        // skip
      }
    }

    // Only if this root is itself a change worktree path
    addKebabName(found, worktreeLeafChangeName(root));
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
