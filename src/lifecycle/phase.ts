import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type SpecReviewPhase = "ok" | "archived" | "active_and_archived";

export type PhaseScanResult = {
  phase: SpecReviewPhase;
  activeRoots: string[];
  archivePaths: string[];
};

/**
 * True if leaf dir name is an archive folder for change, e.g.
 * 2026-07-12-my-change or my-change (rare).
 */
export function isArchiveDirNameForChange(dirName: string, change: string): boolean {
  if (dirName === change) return true;
  // YYYY-MM-DD-<change>
  const m = dirName.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  if (m && m[1] === change) return true;
  // suffix match: ...-change when change is kebab
  if (dirName.endsWith(`-${change}`) && /^\d{4}-\d{2}-\d{2}-/.test(dirName)) {
    return true;
  }
  return false;
}

export function findActiveChangeDir(root: string, change: string): string | null {
  const p = join(root, "openspec", "changes", change);
  return existsSync(p) ? p : null;
}

export function findArchiveDirsForChange(root: string, change: string): string[] {
  const archiveRoot = join(root, "openspec", "changes", "archive");
  if (!existsSync(archiveRoot)) return [];
  let names: string[] = [];
  try {
    names = readdirSync(archiveRoot);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    if (!isArchiveDirNameForChange(name, change)) continue;
    const full = join(archiveRoot, name);
    try {
      if (statSync(full).isDirectory()) out.push(full);
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Detect whether ops-spec-review should proceed for `change` given checkout roots
 * (e.g. primary + worktree paths).
 */
export function detectSpecReviewPhase(
  change: string,
  roots: string[],
): PhaseScanResult {
  const activeRoots: string[] = [];
  const archivePaths: string[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    if (!root || seen.has(root)) continue;
    seen.add(root);
    const active = findActiveChangeDir(root, change);
    if (active) activeRoots.push(active);
    for (const a of findArchiveDirsForChange(root, change)) {
      archivePaths.push(a);
    }
  }

  const hasActive = activeRoots.length > 0;
  const hasArchive = archivePaths.length > 0;

  if (hasActive && hasArchive) {
    return { phase: "active_and_archived", activeRoots, archivePaths };
  }
  if (!hasActive && hasArchive) {
    return { phase: "archived", activeRoots, archivePaths };
  }
  return { phase: "ok", activeRoots, archivePaths };
}

/** User text requests historical re-review override. */
export function isHistoricalSpecReviewOverride(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("historical") ||
    t.includes("force") ||
    t.includes("--force") ||
    t.includes("re-review archive") ||
    t.includes("override phase")
  );
}
