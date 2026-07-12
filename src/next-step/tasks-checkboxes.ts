import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Open task box: `- [ ]` with optional leading spaces. */
const OPEN_BOX = /^\s*-\s+\[\s\]\s+/;
/** Completed: `- [x]` / `- [X]`. */
const DONE_BOX = /^\s*-\s+\[[xX]\]\s+/;

export type TasksCheckboxSummary = {
  /** Absolute path if found under a root */
  path: string | null;
  open: number;
  done: number;
  /** open + done */
  total: number;
};

/**
 * Parse task checkbox lines from tasks.md body.
 * Lines without checkbox markers are ignored.
 */
export function summarizeTaskCheckboxes(content: string): {
  open: number;
  done: number;
  total: number;
} {
  let open = 0;
  let done = 0;
  for (const line of content.split(/\r?\n/)) {
    if (OPEN_BOX.test(line)) open += 1;
    else if (DONE_BOX.test(line)) done += 1;
  }
  return { open, done, total: open + done };
}

/**
 * Locate tasks.md under openspec/changes/<change>/ across roots (first hit).
 */
export function findTasksMd(change: string, roots: string[]): string | null {
  for (const root of roots) {
    if (!root) continue;
    const p = join(root, "openspec", "changes", change, "tasks.md");
    if (existsSync(p)) return p;
  }
  return null;
}

export function readTasksCheckboxSummary(
  change: string,
  roots: string[],
): TasksCheckboxSummary {
  const path = findTasksMd(change, roots);
  if (!path) {
    return { path: null, open: 0, done: 0, total: 0 };
  }
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return { path, open: 0, done: 0, total: 0 };
  }
  const s = summarizeTaskCheckboxes(content);
  return { path, ...s };
}

/**
 * True when tasks.md exists, has at least one checkbox, and none are open.
 * Missing tasks.md or zero checkboxes → false (not "all complete").
 */
export function areAllTasksComplete(change: string, roots: string[]): boolean {
  const s = readTasksCheckboxSummary(change, roots);
  return s.total > 0 && s.open === 0;
}
