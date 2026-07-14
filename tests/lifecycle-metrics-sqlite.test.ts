import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LifecycleMetricsRuntime,
  METRICS_SCHEMA_VERSION,
  appendMetricsRecord,
  buildMetricsReport,
  defaultMetricsSqlitePath,
  destroyMetricsSqlite,
  detachMetricsSqlite,
  formatMetricsReport,
  getMetricsSqliteStatus,
  initMetricsSqlite,
  metricsConfigPath,
  metricsDataDir,
  readMetricsConfig,
  readMetricsRecords,
  readMetricsSqlite,
  rebuildMetricsSqlite,
  resetMetricsData,
  resolveWorkspaceId,
  sessionMetricsPath,
  setMetricsEnabled,
  syncMetricsSqlite,
  type RawUsage,
  type TurnMetricRecord,
} from "../src/lifecycle-metrics/index.js";
import { createFixtureRepo } from "./helpers/fixture.js";

const usage: RawUsage = {
  input: 10,
  output: 2,
  cacheRead: 1,
  cacheWrite: 0,
  totalTokens: 13,
  cost: {
    input: 0.01,
    output: 0.01,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0.02,
  },
};

function turn(recordId: string, timestamp = 1): TurnMetricRecord {
  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    recordId,
    workspaceId: null,
    timestamp,
    sessionIdHash: "session-hash",
    kind: "turn",
    change: "demo-change",
    deliveryAttemptId: null,
    action: "opsx-apply",
    attribution: "observed",
    reviewRound: null,
    model: { provider: "provider", id: "model" },
    usage,
    context: null,
  };
}

function tempAgent(): string {
  return mkdtempSync(join(tmpdir(), "ops-metrics-sqlite-"));
}

describe("metrics schema-v2 identity", () => {
  it("assigns unique record IDs and a cached workspace ID to runtime records", () => {
    const records: TurnMetricRecord[] = [];
    let workspaceCalls = 0;
    const runtime = new LifecycleMetricsRuntime({
      sessionIdHash: "session-hash",
      workspaceId: () => {
        workspaceCalls += 1;
        return "a".repeat(64);
      },
      enabled: () => true,
      append: (record) => {
        if (record.kind === "turn") records.push(record);
      },
    });
    const input = {
      text: "",
      provider: "provider",
      model: "model",
      usage,
      context: null,
    } as const;
    runtime.recordTurn(input);
    runtime.recordTurn(input);

    expect(records).toHaveLength(2);
    expect(records[0]?.recordId).not.toBe(records[1]?.recordId);
    expect(records.every((record) => record.workspaceId === "a".repeat(64))).toBe(true);
    expect(workspaceCalls).toBe(1);
  });

  it("uses one hashed identity for linked worktrees and distinct repositories", () => {
    const first = createFixtureRepo();
    const second = createFixtureRepo();
    const linked = join(dirname(first.root), `${first.root.split("/").at(-1)}-linked`);
    try {
      first.git("worktree", "add", "-b", "metrics-linked", linked);
      const primaryId = resolveWorkspaceId(first.root);
      expect(primaryId).toMatch(/^[a-f0-9]{64}$/);
      expect(resolveWorkspaceId(linked)).toBe(primaryId);
      expect(resolveWorkspaceId(second.root)).not.toBe(primaryId);
      const outside = mkdtempSync(join(tmpdir(), "ops-metrics-not-git-"));
      try {
        expect(resolveWorkspaceId(outside)).toBeNull();
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    } finally {
      first.cleanup();
      second.cleanup();
      rmSync(linked, { recursive: true, force: true });
    }
  });

  it("normalizes schema-v1 JSON with stable legacy identity", () => {
    const agentDir = tempAgent();
    try {
      const current = turn("discarded");
      const { recordId: _recordId, workspaceId: _workspaceId, ...legacyBody } = current;
      const legacy = { ...legacyBody, schemaVersion: 1 };
      mkdirSync(metricsDataDir(agentDir), { recursive: true });
      writeFileSync(
        sessionMetricsPath(agentDir, current.sessionIdHash),
        `${JSON.stringify(legacy)}\n`,
      );

      const first = readMetricsRecords(agentDir);
      const second = readMetricsRecords(agentDir);
      expect(first.legacyRecords).toBe(1);
      expect(first.malformedLines).toBe(0);
      expect(first.records[0]?.schemaVersion).toBe(METRICS_SCHEMA_VERSION);
      expect(first.records[0]?.workspaceId).toBeNull();
      expect(first.records[0]?.recordId).toMatch(/^legacy-[a-f0-9]{64}$/);
      expect(second.records[0]?.recordId).toBe(first.records[0]?.recordId);
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });
});

describe("optional SQLite metrics projection", () => {
  it("migrates config without losing enabled or SQLite attachment", async () => {
    const agentDir = tempAgent();
    try {
      mkdirSync(dirname(metricsConfigPath(agentDir)), { recursive: true });
      writeFileSync(metricsConfigPath(agentDir), '{"enabled":true}\n');
      expect(readMetricsConfig(agentDir)).toEqual({ enabled: true });

      const status = await initMetricsSqlite(agentDir);
      expect(status.rows).toBe(0);
      expect(readMetricsConfig(agentDir)).toEqual({
        enabled: true,
        sqlitePath: defaultMetricsSqlitePath(agentDir),
      });

      setMetricsEnabled(agentDir, false);
      expect(readMetricsConfig(agentDir)).toEqual({
        enabled: false,
        sqlitePath: defaultMetricsSqlitePath(agentDir),
      });
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("never creates SQLite through ordinary JSON collection", async () => {
    const agentDir = tempAgent();
    try {
      setMetricsEnabled(agentDir, true);
      appendMetricsRecord(agentDir, turn("json-only"));
      expect(existsSync(defaultMetricsSqlitePath(agentDir))).toBe(false);
      const status = await getMetricsSqliteStatus(agentDir);
      expect(status.available).toBe(true);
      expect(status.configured).toBe(false);
      expect(readMetricsRecords(agentDir).records).toHaveLength(1);
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("creates a secure selected DB and synchronizes idempotently", async () => {
    const agentDir = tempAgent();
    const path = join(agentDir, "central metrics", "all.sqlite3");
    try {
      appendMetricsRecord(agentDir, turn("record-one"));
      appendFileSync(sessionMetricsPath(agentDir, "session-hash"), "not-json\n");

      const initialized = await initMetricsSqlite(agentDir, path);
      expect(initialized.path).toBe(path);
      expect(initialized.rows).toBe(0);
      expect(statSync(path).mode & 0o777).toBe(0o600);

      const first = await syncMetricsSqlite(agentDir);
      expect(first).toMatchObject({
        scanned: 1,
        inserted: 1,
        duplicates: 0,
        malformed: 1,
      });
      const second = await syncMetricsSqlite(agentDir);
      expect(second).toMatchObject({ scanned: 1, inserted: 0, duplicates: 1 });

      const data = await readMetricsSqlite(agentDir);
      expect(data.records.map((record) => record.recordId)).toEqual(["record-one"]);
      const report = formatMetricsReport(
        buildMetricsReport(data.records, {
          source: "sqlite",
          projection: { rows: data.rows, lastSyncAt: data.lastSyncAt },
        }),
      );
      expect(report).toContain("Source: SQLite projection; rows: 1; last sync:");

      resetMetricsData(agentDir);
      expect(existsSync(path)).toBe(true);
      expect((await readMetricsSqlite(agentDir)).records).toHaveLength(1);
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("keeps a configured DB inside the metrics directory during JSON reset", async () => {
    const agentDir = tempAgent();
    const path = join(metricsDataDir(agentDir), "projection.sqlite3");
    try {
      appendMetricsRecord(agentDir, turn("inside-metrics-dir"));
      await initMetricsSqlite(agentDir, path);
      await syncMetricsSqlite(agentDir);

      resetMetricsData(agentDir);
      expect(existsSync(path)).toBe(true);
      expect(readMetricsRecords(agentDir).records).toEqual([]);
      expect((await readMetricsSqlite(agentDir)).records.map((r) => r.recordId)).toEqual([
        "inside-metrics-dir",
      ]);
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("ingests legacy records once and reports legacy/malformed counts", async () => {
    const agentDir = tempAgent();
    try {
      const current = turn("discarded");
      const { recordId: _recordId, workspaceId: _workspaceId, ...legacyBody } = current;
      mkdirSync(metricsDataDir(agentDir), { recursive: true });
      writeFileSync(
        sessionMetricsPath(agentDir, current.sessionIdHash),
        `${JSON.stringify({ ...legacyBody, schemaVersion: 1 })}\n{}\n`,
      );
      await initMetricsSqlite(agentDir);
      const first = await syncMetricsSqlite(agentDir);
      const second = await syncMetricsSqlite(agentDir);
      expect(first).toMatchObject({ legacy: 1, malformed: 1, inserted: 1 });
      expect(second).toMatchObject({ legacy: 1, malformed: 1, duplicates: 1 });
      expect((await readMetricsSqlite(agentDir)).records[0]?.workspaceId).toBeNull();
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("protects relative and incompatible paths without overwriting", async () => {
    const agentDir = tempAgent();
    const incompatible = join(agentDir, "not-metrics.db");
    try {
      await expect(initMetricsSqlite(agentDir, "relative.db")).rejects.toMatchObject({
        code: "sqlite_path_not_absolute",
      });
      await expect(
        initMetricsSqlite(agentDir, join(agentDir, "reserved.jsonl")),
      ).rejects.toMatchObject({ code: "sqlite_path_conflicts_jsonl" });
      expect(existsSync(join(agentDir, "reserved.jsonl"))).toBe(false);
      writeFileSync(incompatible, "not a sqlite database");
      await expect(initMetricsSqlite(agentDir, incompatible)).rejects.toMatchObject({
        code: "sqlite_open_failed",
      });
      expect(readFileSync(incompatible, "utf8")).toBe("not a sqlite database");
      expect(readMetricsConfig(agentDir).sqlitePath).toBeUndefined();
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("rebuilds from retained JSON and keeps destructive boundaries separate", async () => {
    const agentDir = tempAgent();
    try {
      appendMetricsRecord(agentDir, turn("old-record", 1));
      await initMetricsSqlite(agentDir);
      await syncMetricsSqlite(agentDir);
      resetMetricsData(agentDir);
      appendMetricsRecord(agentDir, turn("new-record", 2));

      await expect(rebuildMetricsSqlite(agentDir, false)).rejects.toMatchObject({
        code: "sqlite_confirmation_required",
      });
      const rebuilt = await rebuildMetricsSqlite(agentDir, true);
      expect(rebuilt).toMatchObject({ scanned: 1, inserted: 1, duplicates: 0 });
      expect((await readMetricsSqlite(agentDir)).records.map((r) => r.recordId)).toEqual([
        "new-record",
      ]);
      expect(readMetricsRecords(agentDir).records).toHaveLength(1);
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("detaches without deleting and destroys only after confirmation", async () => {
    const agentDir = tempAgent();
    try {
      setMetricsEnabled(agentDir, true);
      appendMetricsRecord(agentDir, turn("kept-json"));
      const status = await initMetricsSqlite(agentDir);
      const path = status.path!;
      await syncMetricsSqlite(agentDir);
      expect(detachMetricsSqlite(agentDir)).toBe(path);
      expect(existsSync(path)).toBe(true);
      expect(readMetricsConfig(agentDir)).toEqual({ enabled: true });

      await initMetricsSqlite(agentDir, path);
      expect((await readMetricsSqlite(agentDir)).records).toHaveLength(1);
      await expect(destroyMetricsSqlite(agentDir, false)).rejects.toMatchObject({
        code: "sqlite_confirmation_required",
      });
      expect(existsSync(path)).toBe(true);
      expect((await destroyMetricsSqlite(agentDir, true)).deleted).toBe(true);
      expect(existsSync(path)).toBe(false);
      expect(readMetricsConfig(agentDir)).toEqual({ enabled: true });
      expect(readMetricsRecords(agentDir).records).toHaveLength(1);
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("feature-gates node:sqlite without creating files", async () => {
    const agentDir = tempAgent();
    const unavailable = async () => {
      throw new Error("module missing");
    };
    try {
      const status = await getMetricsSqliteStatus(agentDir, unavailable);
      expect(status.available).toBe(false);
      await expect(initMetricsSqlite(agentDir, undefined, unavailable)).rejects.toMatchObject({
        code: "sqlite_unavailable",
      });
      expect(existsSync(defaultMetricsSqlitePath(agentDir))).toBe(false);
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });
});
