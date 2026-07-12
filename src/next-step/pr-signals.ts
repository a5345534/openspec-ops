import {
  findOpenPullRequest,
  resolveMergeStatusBackend,
} from "../ship/backends/gh.js";

export type PrSignals = {
  hasOpenPr: boolean;
  hasMergedPr: boolean;
  /** true if either lookup threw (gh missing/failed) */
  queryFailed: boolean;
};

export type PrSignalsDeps = {
  findOpen?: (cwd: string, head: string) => unknown | null;
  findMerged?: (input: { cwd: string; head: string }) => unknown | null;
};

/**
 * Soft PR status for guided next-step. Never throws.
 */
export function resolvePrSignals(
  cwd: string,
  head: string,
  deps: PrSignalsDeps = {},
): PrSignals {
  const findOpen = deps.findOpen ?? findOpenPullRequest;
  const findMerged =
    deps.findMerged ??
    ((input: { cwd: string; head: string }) =>
      resolveMergeStatusBackend("gh").findMergedPullRequest(input));

  let hasOpenPr = false;
  let hasMergedPr = false;
  let queryFailed = false;

  try {
    hasOpenPr = findOpen(cwd, head) != null;
  } catch {
    queryFailed = true;
  }

  try {
    hasMergedPr = findMerged({ cwd, head }) != null;
  } catch {
    queryFailed = true;
  }

  return { hasOpenPr, hasMergedPr, queryFailed };
}
