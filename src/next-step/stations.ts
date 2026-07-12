import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  findActiveChangeDir,
  findArchiveDirsForChange,
} from "../lifecycle/phase.js";
import { areAllTasksComplete } from "./tasks-checkboxes.js";
import type { LifecycleStation } from "./edges.js";

export type StationSignals = {
  change: string;
  /** Repo roots to scan (primary, worktree, cwd) */
  roots: string[];
  /** where.found */
  worktreeFound: boolean;
  /** where.dirty — unused for station id but available to callers */
  worktreeDirty?: boolean;
  /** Open PR exists for change branch */
  hasOpenPr: boolean;
  /** Merged PR exists for change branch */
  hasMergedPr: boolean;
};

function hasProposal(change: string, roots: string[]): boolean {
  for (const root of roots) {
    if (!root) continue;
    if (existsSync(join(root, "openspec", "changes", change, "proposal.md"))) {
      return true;
    }
  }
  return false;
}

function hasActiveChangeDir(change: string, roots: string[]): boolean {
  for (const root of roots) {
    if (findActiveChangeDir(root, change)) return true;
  }
  return false;
}

function hasArchive(change: string, roots: string[]): boolean {
  for (const root of roots) {
    if (findArchiveDirsForChange(root, change).length > 0) return true;
  }
  return false;
}

/**
 * Pure station detection from explicit signals (testable).
 */
export function detectLifecycleStation(signals: StationSignals): LifecycleStation {
  const { change, roots } = signals;
  const archived = hasArchive(change, roots);
  const active = hasActiveChangeDir(change, roots);
  const proposal = hasProposal(change, roots);
  const tasksDone = areAllTasksComplete(change, roots);

  if (!signals.worktreeFound && archived && !active) {
    return "done";
  }
  if (!signals.worktreeFound && !active && !archived) {
    return "no_workspace";
  }
  if (archived && signals.worktreeFound) {
    return "archived";
  }
  if (archived && !signals.worktreeFound) {
    return "done";
  }
  if (signals.hasMergedPr && active) {
    return "merged";
  }
  if (signals.hasOpenPr) {
    return "shipped";
  }
  if (proposal && tasksDone) {
    return "applied";
  }
  if (proposal) {
    return "proposed";
  }
  if (signals.worktreeFound) {
    return "ready_to_propose";
  }
  return "unknown";
}
