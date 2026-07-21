/**
 * Text catalogs and label helpers for /ops-config and /ops-metrics guided menus.
 */

import {
  FINISH_RETURN_TO_MAIN_KEY,
  IMPL_REVIEW_MAX_ROUNDS_KEY,
  SPEC_REVIEW_MAX_ROUNDS_KEY,
  listKnownKeys,
  showAll,
  type ConfigEntry,
} from "../pi-config/index.js";

export function formatConfigTextCatalog(
  env: NodeJS.ProcessEnv,
  agentDir: string,
): string {
  const rows = showAll(env, agentDir);
  return [
    "ops-config (no UI — nothing auto-changed)",
    "Effective:",
    ...rows.map((r) => `  ${r.key}=${r.value} (${r.source})`),
    "",
    "Direct: show | get <key> | set [--user] <key> <value> | unset [--user] <key> | reset [--user]",
    `Keys: ${listKnownKeys().join(", ")}`,
    "Session overrides reset when Pi restarts; --user persists under the agent directory.",
  ].join("\n");
}

export function formatMetricsTextCatalog(enabled: boolean): string {
  return [
    `ops-metrics (no UI — nothing auto-changed); collection: ${enabled ? "enabled" : "disabled"}`,
    "Direct: status | on | off | report [change] | report --source sqlite [change] | export [change] | reset confirm | db …",
    "With UI, bare /ops-metrics opens a guided menu.",
  ].join("\n");
}

export function configRootLabels(rows: ConfigEntry[]): string[] {
  return [
    "Show all",
    "Edit a setting…",
    "Clear session overrides",
    "Clear user preferences…",
    "Cancel",
  ];
}

export function configKeyLabels(rows: ConfigEntry[]): string[] {
  return rows.map((r) => `${r.key} = ${r.value} (${r.source})`);
}

export function keyFromConfigLabel(label: string): string | null {
  const key = label.split(" = ")[0]?.trim();
  return key && listKnownKeys().includes(key) ? key : null;
}

export function valueChoicesForKey(key: string): string[] | null {
  if (key === FINISH_RETURN_TO_MAIN_KEY) {
    return ["off", "primary-only", "required", "Cancel"];
  }
  if (key === SPEC_REVIEW_MAX_ROUNDS_KEY || key === IMPL_REVIEW_MAX_ROUNDS_KEY) {
    return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Cancel"];
  }
  return null;
}

export function saveWhereLabels(): string[] {
  return ["This session only", "User default (persist)", "Cancel"];
}

export function metricsRootLabels(enabled: boolean): string[] {
  return [
    "Status",
    enabled ? "Disable collection" : "Enable collection",
    "Report…",
    "Export…",
    "Database…",
    "Reset JSONL…",
    "Cancel",
  ];
}

export function metricsReportSourceLabels(): string[] {
  return ["JSONL (authoritative)", "SQLite projection", "Cancel"];
}

export function metricsScopeLabels(): string[] {
  return ["All changes", "One change…", "Cancel"];
}

export function metricsDbLabels(): string[] {
  return [
    "Status",
    "Init default path",
    "Init custom path…",
    "Sync from JSONL",
    "Rebuild…",
    "Detach (keep file)",
    "Destroy…",
    "Cancel",
  ];
}

export function stripUserFlag(parts: string[]): { user: boolean; rest: string[] } {
  let user = false;
  const rest: string[] = [];
  for (const part of parts) {
    if (part === "--user") user = true;
    else rest.push(part);
  }
  return { user, rest };
}
