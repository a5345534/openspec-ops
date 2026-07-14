import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  METRICS_ACTIONS,
  METRICS_SCHEMA_VERSION,
  type MetricsRecord,
} from "./types.js";

export type MetricsConfig = { enabled: boolean };

const DEFAULT_CONFIG: MetricsConfig = { enabled: false };
const ROOT_DIR = "openspec-ops";
const CONFIG_FILE = "metrics-config.json";
const METRICS_DIR = "metrics";

export function metricsRoot(agentDir: string): string {
  return join(agentDir, ROOT_DIR);
}

export function metricsDataDir(agentDir: string): string {
  return join(metricsRoot(agentDir), METRICS_DIR);
}

export function metricsConfigPath(agentDir: string): string {
  return join(metricsRoot(agentDir), CONFIG_FILE);
}

export function readMetricsConfig(agentDir: string): MetricsConfig {
  const path = metricsConfigPath(agentDir);
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof (parsed as { enabled?: unknown }).enabled === "boolean"
    ) {
      return { enabled: (parsed as { enabled: boolean }).enabled };
    }
  } catch {
    // Invalid local config is treated as disabled.
  }
  return { ...DEFAULT_CONFIG };
}

export function writeMetricsConfig(
  agentDir: string,
  config: MetricsConfig,
): void {
  mkdirSync(metricsRoot(agentDir), { recursive: true });
  writeFileSync(metricsConfigPath(agentDir), `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function setMetricsEnabled(agentDir: string, enabled: boolean): void {
  writeMetricsConfig(agentDir, { enabled });
}

export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId || "ephemeral").digest("hex").slice(0, 16);
}

export function createAttemptId(): string {
  return randomUUID();
}

export function sessionMetricsPath(
  agentDir: string,
  sessionIdHash: string,
): string {
  return join(metricsDataDir(agentDir), `${sessionIdHash}.jsonl`);
}

export function appendMetricsRecord(agentDir: string, record: MetricsRecord): void {
  const dir = metricsDataDir(agentDir);
  mkdirSync(dir, { recursive: true });
  appendFileSync(
    sessionMetricsPath(agentDir, record.sessionIdHash),
    `${JSON.stringify(record)}\n`,
    { mode: 0o600 },
  );
}

function object(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const ACTIONS = new Set<string>(METRICS_ACTIONS);
const STATIONS = new Set([
  "no_workspace",
  "ready_to_propose",
  "proposed",
  "applied",
  "shipped",
  "merged",
  "archived",
  "done",
  "unknown",
]);

function validUsage(value: unknown): boolean {
  if (!object(value) || !object(value.cost)) return false;
  return (
    finite(value.input) &&
    finite(value.output) &&
    finite(value.cacheRead) &&
    finite(value.cacheWrite) &&
    finite(value.totalTokens) &&
    (value.reasoning == null || finite(value.reasoning)) &&
    finite(value.cost.input) &&
    finite(value.cost.output) &&
    finite(value.cost.cacheRead) &&
    finite(value.cost.cacheWrite) &&
    finite(value.cost.total)
  );
}

function looksLikeRecord(value: unknown): value is MetricsRecord {
  if (!object(value)) return false;
  if (value.schemaVersion !== METRICS_SCHEMA_VERSION) return false;
  if (!finite(value.timestamp) || typeof value.sessionIdHash !== "string") {
    return false;
  }
  if (value.kind === "turn") {
    return (
      (value.change == null || typeof value.change === "string") &&
      (value.deliveryAttemptId == null || typeof value.deliveryAttemptId === "string") &&
      typeof value.action === "string" &&
      ACTIONS.has(value.action) &&
      (value.attribution === "observed" ||
        value.attribution === "declared" ||
        value.attribution === "unknown") &&
      (value.reviewRound == null || finite(value.reviewRound)) &&
      object(value.model) &&
      typeof value.model.provider === "string" &&
      typeof value.model.id === "string" &&
      validUsage(value.usage) &&
      (value.context == null ||
        (object(value.context) &&
          (value.context.tokens == null || finite(value.context.tokens)) &&
          finite(value.context.contextWindow) &&
          (value.context.percent == null || finite(value.context.percent))))
    );
  }
  if (value.kind === "review_round") {
    return (
      typeof value.change === "string" &&
      (value.deliveryAttemptId == null || typeof value.deliveryAttemptId === "string") &&
      (value.reviewType === "spec" || value.reviewType === "impl") &&
      finite(value.round) &&
      typeof value.missing === "boolean" &&
      (value.missing ||
        (finite(value.newMajors) &&
          finite(value.newMinors) &&
          finite(value.majorsFixed) &&
          typeof value.fixVerificationPassed === "boolean" &&
          (value.verdict === "continue" ||
            value.verdict === "ready" ||
            value.verdict === "needs_human")))
    );
  }
  if (value.kind === "deliver_attempt") {
    return (
      (value.event === "start" || value.event === "settled") &&
      typeof value.attemptId === "string" &&
      typeof value.change === "string" &&
      typeof value.resume === "boolean" &&
      typeof value.startStation === "string" &&
      STATIONS.has(value.startStation) &&
      (value.event === "start" ||
        (typeof value.endStation === "string" &&
          STATIONS.has(value.endStation) &&
          (value.outcome === "completed" ||
            value.outcome === "hard_stop" ||
            value.outcome === "needs_human" ||
            value.outcome === "incomplete")))
    );
  }
  return false;
}

export function readMetricsRecords(agentDir: string): {
  records: MetricsRecord[];
  malformedLines: number;
  files: number;
} {
  const dir = metricsDataDir(agentDir);
  if (!existsSync(dir)) return { records: [], malformedLines: 0, files: 0 };
  const records: MetricsRecord[] = [];
  let malformedLines = 0;
  let files = 0;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir).filter((name) => name.endsWith(".jsonl"));
  } catch {
    return { records, malformedLines: 1, files };
  }
  for (const name of entries) {
    files += 1;
    let text = "";
    try {
      text = readFileSync(join(dir, name), "utf8");
    } catch {
      malformedLines += 1;
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const value: unknown = JSON.parse(line);
        if (looksLikeRecord(value)) records.push(value);
        else malformedLines += 1;
      } catch {
        malformedLines += 1;
      }
    }
  }
  records.sort((a, b) => a.timestamp - b.timestamp);
  return { records, malformedLines, files };
}

export function resetMetricsData(agentDir: string): void {
  rmSync(metricsDataDir(agentDir), { recursive: true, force: true });
}
