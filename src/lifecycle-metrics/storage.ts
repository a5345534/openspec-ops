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
import { isAbsolute, join, resolve as resolvePath } from "node:path";
import {
  LEGACY_METRICS_SCHEMA_VERSION,
  METRICS_ACTIONS,
  METRICS_SCHEMA_VERSION,
  type MetricsRecord,
} from "./types.js";

export type MetricsConfig = { enabled: boolean; sqlitePath?: string };

const DEFAULT_CONFIG: MetricsConfig = { enabled: false };
const ROOT_DIR = "openspec-ops";
const CONFIG_FILE = "metrics-config.json";
const METRICS_DIR = "metrics";
const RECORD_ID_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const WORKSPACE_ID_RE = /^[a-f0-9]{64}$/;

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
      const value = parsed as { enabled: boolean; sqlitePath?: unknown };
      return {
        enabled: value.enabled,
        ...(typeof value.sqlitePath === "string" && isAbsolute(value.sqlitePath)
          ? { sqlitePath: value.sqlitePath }
          : {}),
      };
    }
  } catch {
    // Invalid local config is treated as disabled and unattached.
  }
  return { ...DEFAULT_CONFIG };
}

export function writeMetricsConfig(
  agentDir: string,
  config: MetricsConfig,
): void {
  if (config.sqlitePath != null && !isAbsolute(config.sqlitePath)) {
    throw new Error("SQLite metrics path must be absolute");
  }
  mkdirSync(metricsRoot(agentDir), { recursive: true });
  writeFileSync(metricsConfigPath(agentDir), `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function setMetricsEnabled(agentDir: string, enabled: boolean): void {
  writeMetricsConfig(agentDir, { ...readMetricsConfig(agentDir), enabled });
}

export function setMetricsSqlitePath(
  agentDir: string,
  sqlitePath: string | null,
): void {
  const config = readMetricsConfig(agentDir);
  if (sqlitePath == null) {
    const { sqlitePath: _discarded, ...rest } = config;
    writeMetricsConfig(agentDir, rest);
    return;
  }
  writeMetricsConfig(agentDir, { ...config, sqlitePath });
}

export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId || "ephemeral").digest("hex").slice(0, 16);
}

export function createAttemptId(): string {
  return randomUUID();
}

export function createMetricsRecordId(): string {
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

function nonNegative(value: unknown): value is number {
  return finite(value) && value >= 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return nonNegative(value) && Number.isInteger(value);
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
    nonNegative(value.input) &&
    nonNegative(value.output) &&
    nonNegative(value.cacheRead) &&
    nonNegative(value.cacheWrite) &&
    nonNegative(value.totalTokens) &&
    (value.reasoning == null || nonNegative(value.reasoning)) &&
    nonNegative(value.cost.input) &&
    nonNegative(value.cost.output) &&
    nonNegative(value.cost.cacheRead) &&
    nonNegative(value.cost.cacheWrite) &&
    nonNegative(value.cost.total)
  );
}

function validRecordBody(value: Record<string, unknown>): boolean {
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
      (value.reviewRound == null ||
        (nonNegativeInteger(value.reviewRound) && value.reviewRound >= 1 && value.reviewRound <= 10)) &&
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
      nonNegativeInteger(value.round) &&
      value.round >= 1 &&
      value.round <= 10 &&
      typeof value.missing === "boolean" &&
      (value.missing ||
        (nonNegativeInteger(value.newMajors) &&
          nonNegativeInteger(value.newMinors) &&
          nonNegativeInteger(value.majorsFixed) &&
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

export function parseMetricsRecordValue(value: unknown): MetricsRecord | null {
  if (!object(value) || value.schemaVersion !== METRICS_SCHEMA_VERSION) return null;
  if (typeof value.recordId !== "string" || !RECORD_ID_RE.test(value.recordId)) {
    return null;
  }
  if (
    value.workspaceId !== null &&
    (typeof value.workspaceId !== "string" || !WORKSPACE_ID_RE.test(value.workspaceId))
  ) {
    return null;
  }
  return validRecordBody(value) ? (value as MetricsRecord) : null;
}

function isLegacyRecord(value: unknown): value is Record<string, unknown> {
  return (
    object(value) &&
    value.schemaVersion === LEGACY_METRICS_SCHEMA_VERSION &&
    validRecordBody(value)
  );
}

function legacyRecordId(
  sourceName: string,
  lineNumber: number,
  originalLine: string,
): string {
  const digest = createHash("sha256")
    .update(sourceName)
    .update("\0")
    .update(String(lineNumber))
    .update("\0")
    .update(originalLine)
    .digest("hex");
  return `legacy-${digest}`;
}

function normalizeRecordLine(
  line: string,
  sourceName: string,
  lineNumber: number,
): { record: MetricsRecord; legacy: boolean } | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  const current = parseMetricsRecordValue(value);
  if (current) return { record: current, legacy: false };
  if (!isLegacyRecord(value)) return null;
  const normalized = {
    ...value,
    schemaVersion: METRICS_SCHEMA_VERSION,
    recordId: legacyRecordId(sourceName, lineNumber, line),
    workspaceId: null,
  };
  const parsed = parseMetricsRecordValue(normalized);
  return parsed ? { record: parsed, legacy: true } : null;
}

export type MetricsReadResult = {
  records: MetricsRecord[];
  malformedLines: number;
  legacyRecords: number;
  files: number;
};

export function readMetricsRecords(agentDir: string): MetricsReadResult {
  const dir = metricsDataDir(agentDir);
  if (!existsSync(dir)) {
    return { records: [], malformedLines: 0, legacyRecords: 0, files: 0 };
  }
  const records: MetricsRecord[] = [];
  const protectedSqlitePath = readMetricsConfig(agentDir).sqlitePath;
  let malformedLines = 0;
  let legacyRecords = 0;
  let files = 0;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir)
      .filter((name) => name.endsWith(".jsonl"))
      .sort();
  } catch {
    return { records, malformedLines: 1, legacyRecords, files };
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (
      protectedSqlitePath &&
      resolvePath(protectedSqlitePath) === resolvePath(path)
    ) {
      continue;
    }
    files += 1;
    let text = "";
    try {
      text = readFileSync(path, "utf8");
    } catch {
      malformedLines += 1;
      continue;
    }
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (!line.trim()) continue;
      const parsed = normalizeRecordLine(line, name, index + 1);
      if (!parsed) {
        malformedLines += 1;
        continue;
      }
      records.push(parsed.record);
      if (parsed.legacy) legacyRecords += 1;
    }
  }
  records.sort((a, b) => a.timestamp - b.timestamp);
  return { records, malformedLines, legacyRecords, files };
}

export function resetMetricsData(agentDir: string): void {
  const dir = metricsDataDir(agentDir);
  if (!existsSync(dir)) return;
  const protectedSqlitePath = readMetricsConfig(agentDir).sqlitePath;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".jsonl")) continue;
    const path = join(dir, name);
    if (
      protectedSqlitePath &&
      resolvePath(protectedSqlitePath) === resolvePath(path)
    ) {
      continue;
    }
    rmSync(path, { force: true });
  }
}
