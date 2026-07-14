import type { DatabaseSync } from "node:sqlite";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  metricsRoot,
  parseMetricsRecordValue,
  readMetricsConfig,
  readMetricsRecords,
  setMetricsSqlitePath,
  type MetricsReadResult,
} from "./storage.js";
import type { MetricsRecord } from "./types.js";

const DATABASE_FILE = "metrics.sqlite3";
const APPLICATION_ID = 0x4f534f4d; // "OSOM" (openspec-ops metrics)
const DATABASE_SCHEMA_VERSION = 1;
const BUSY_TIMEOUT_MS = 5_000;

type SqliteModule = { DatabaseSync: typeof DatabaseSync };
export type SqliteLoader = () => Promise<SqliteModule>;

const loadDefault: SqliteLoader = async () =>
  (await import("node:sqlite")) as SqliteModule;

export class MetricsSqliteError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MetricsSqliteError";
    this.code = code;
  }
}

export type MetricsSqliteStatus = {
  available: boolean;
  reason?: string;
  configured: boolean;
  path: string | null;
  exists: boolean;
  compatible: boolean | null;
  databaseSchemaVersion: number | null;
  rows: number | null;
  lastSyncAt: number | null;
};

export type MetricsSqliteSyncResult = {
  path: string;
  scanned: number;
  inserted: number;
  duplicates: number;
  legacy: number;
  malformed: number;
  lastSyncAt: number;
};

export type MetricsSqliteReadResult = {
  records: MetricsRecord[];
  malformedLines: number;
  rows: number;
  lastSyncAt: number | null;
  path: string;
};

export function defaultMetricsSqlitePath(agentDir: string): string {
  return join(metricsRoot(agentDir), DATABASE_FILE);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadSqlite(loader: SqliteLoader): Promise<SqliteModule> {
  try {
    return await loader();
  } catch (error) {
    throw new MetricsSqliteError(
      "sqlite_unavailable",
      `node:sqlite is unavailable: ${message(error)}`,
    );
  }
}

function numberValue(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function pragmaNumber(db: DatabaseSync, name: string): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as
    | Record<string, unknown>
    | undefined;
  return numberValue(row?.[name]);
}

function metadataValue(db: DatabaseSync, key: string): string | null {
  const row = db
    .prepare("SELECT value FROM projection_meta WHERE key = ?")
    .get(key) as { value?: unknown } | undefined;
  return typeof row?.value === "string" ? row.value : null;
}

function assertCompatible(db: DatabaseSync): number {
  const appId = pragmaNumber(db, "application_id");
  const version = pragmaNumber(db, "user_version");
  if (appId !== APPLICATION_ID) {
    throw new MetricsSqliteError(
      "sqlite_incompatible",
      "Configured file is not an openspec-ops metrics database",
    );
  }
  if (version !== DATABASE_SCHEMA_VERSION) {
    throw new MetricsSqliteError(
      "sqlite_schema_unsupported",
      `Unsupported metrics database schema ${version}; expected ${DATABASE_SCHEMA_VERSION}`,
    );
  }
  const table = db
    .prepare(
      "SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table' AND name IN ('events', 'projection_meta')",
    )
    .get() as { count?: unknown } | undefined;
  if (numberValue(table?.count) !== 2) {
    throw new MetricsSqliteError(
      "sqlite_incompatible",
      "Metrics database is missing required tables",
    );
  }
  return version;
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA application_id = ${APPLICATION_ID};
    PRAGMA user_version = ${DATABASE_SCHEMA_VERSION};
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};
    CREATE TABLE events (
      record_id TEXT PRIMARY KEY,
      record_schema_version INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      kind TEXT NOT NULL,
      workspace_id TEXT,
      session_id_hash TEXT NOT NULL,
      change_name TEXT,
      action TEXT,
      payload TEXT NOT NULL
    );
    CREATE INDEX events_timestamp_idx ON events(timestamp);
    CREATE INDEX events_workspace_idx ON events(workspace_id, change_name);
    CREATE INDEX events_action_idx ON events(action);
    CREATE TABLE projection_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function configureWritable(db: DatabaseSync): void {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}; PRAGMA journal_mode = WAL;`);
}

function openCompatible(
  module: SqliteModule,
  path: string,
  writable: boolean,
): DatabaseSync {
  if (!existsSync(path)) {
    throw new MetricsSqliteError(
      "sqlite_not_found",
      `Configured metrics database does not exist: ${path}`,
    );
  }
  let db: DatabaseSync | null = null;
  try {
    db = new module.DatabaseSync(path, writable ? {} : { readOnly: true });
    assertCompatible(db);
    if (writable) configureWritable(db);
    return db;
  } catch (error) {
    try {
      db?.close();
    } catch {
      // Preserve the primary compatibility/open error.
    }
    if (error instanceof MetricsSqliteError) throw error;
    throw new MetricsSqliteError(
      "sqlite_open_failed",
      `Cannot open metrics database: ${message(error)}`,
    );
  }
}

function configuredPath(agentDir: string): string {
  const path = readMetricsConfig(agentDir).sqlitePath;
  if (!path) {
    throw new MetricsSqliteError(
      "sqlite_not_configured",
      "No SQLite metrics database is configured; run /ops-metrics db init",
    );
  }
  return path;
}

export async function getMetricsSqliteStatus(
  agentDir: string,
  loader: SqliteLoader = loadDefault,
): Promise<MetricsSqliteStatus> {
  const path = readMetricsConfig(agentDir).sqlitePath ?? null;
  let module: SqliteModule;
  try {
    module = await loadSqlite(loader);
  } catch (error) {
    return {
      available: false,
      reason: message(error),
      configured: path != null,
      path,
      exists: path != null && existsSync(path),
      compatible: null,
      databaseSchemaVersion: null,
      rows: null,
      lastSyncAt: null,
    };
  }
  if (!path) {
    return {
      available: true,
      configured: false,
      path: null,
      exists: false,
      compatible: null,
      databaseSchemaVersion: null,
      rows: null,
      lastSyncAt: null,
    };
  }
  if (!existsSync(path)) {
    return {
      available: true,
      configured: true,
      path,
      exists: false,
      compatible: null,
      databaseSchemaVersion: null,
      rows: null,
      lastSyncAt: null,
    };
  }
  let db: DatabaseSync | null = null;
  try {
    db = openCompatible(module, path, false);
    const rows = db.prepare("SELECT count(*) AS count FROM events").get() as
      | { count?: unknown }
      | undefined;
    const lastSync = metadataValue(db, "last_sync_at");
    return {
      available: true,
      configured: true,
      path,
      exists: true,
      compatible: true,
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      rows: numberValue(rows?.count),
      lastSyncAt: lastSync == null ? null : numberValue(Number(lastSync)),
    };
  } catch (error) {
    return {
      available: true,
      reason: message(error),
      configured: true,
      path,
      exists: true,
      compatible: false,
      databaseSchemaVersion: null,
      rows: null,
      lastSyncAt: null,
    };
  } finally {
    try {
      db?.close();
    } catch {
      // Status is best effort.
    }
  }
}

export async function initMetricsSqlite(
  agentDir: string,
  requestedPath?: string,
  loader: SqliteLoader = loadDefault,
): Promise<MetricsSqliteStatus> {
  const module = await loadSqlite(loader);
  const path = requestedPath == null
    ? defaultMetricsSqlitePath(agentDir)
    : requestedPath;
  if (!isAbsolute(path)) {
    throw new MetricsSqliteError(
      "sqlite_path_not_absolute",
      "SQLite metrics path must be absolute",
    );
  }
  const normalized = resolve(path);
  const existed = existsSync(normalized);
  if (existed && !statSync(normalized).isFile()) {
    throw new MetricsSqliteError(
      "sqlite_path_invalid",
      `SQLite metrics path is not a file: ${normalized}`,
    );
  }

  if (existed) {
    let existing: DatabaseSync | null = null;
    try {
      existing = openCompatible(module, normalized, false);
    } finally {
      existing?.close();
    }
  } else {
    mkdirSync(dirname(normalized), { recursive: true });
    let db: DatabaseSync | null = null;
    try {
      db = new module.DatabaseSync(normalized);
      initializeSchema(db);
      db.close();
      db = null;
      chmodSync(normalized, 0o600);
    } catch (error) {
      try {
        db?.close();
      } catch {
        // Preserve initialization error.
      }
      rmSync(normalized, { force: true });
      rmSync(`${normalized}-wal`, { force: true });
      rmSync(`${normalized}-shm`, { force: true });
      if (error instanceof MetricsSqliteError) throw error;
      throw new MetricsSqliteError(
        "sqlite_init_failed",
        `Cannot initialize metrics database: ${message(error)}`,
      );
    }
  }

  setMetricsSqlitePath(agentDir, normalized);
  return getMetricsSqliteStatus(agentDir, loader);
}

function actionForRecord(record: MetricsRecord): string | null {
  if (record.kind === "turn") return record.action;
  if (record.kind === "deliver_attempt") return record.hardStopAction ?? null;
  return null;
}

function changeForRecord(record: MetricsRecord): string | null {
  return record.change;
}

function ingest(
  db: DatabaseSync,
  data: MetricsReadResult,
  replace: boolean,
): MetricsSqliteSyncResult {
  const statement = db.prepare(`
    INSERT OR IGNORE INTO events (
      record_id, record_schema_version, timestamp, kind, workspace_id,
      session_id_hash, change_name, action, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const lastSyncAt = Date.now();
  let inserted = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    if (replace) {
      db.exec("DELETE FROM events; DELETE FROM projection_meta;");
    }
    for (const record of data.records) {
      const result = statement.run(
        record.recordId,
        record.schemaVersion,
        record.timestamp,
        record.kind,
        record.workspaceId,
        record.sessionIdHash,
        changeForRecord(record),
        actionForRecord(record),
        JSON.stringify(record),
      );
      inserted += numberValue(result.changes);
    }
    const meta = db.prepare(`
      INSERT INTO projection_meta(key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    meta.run("last_sync_at", String(lastSyncAt));
    meta.run("last_sync_scanned", String(data.records.length));
    meta.run("last_sync_malformed", String(data.malformedLines));
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the ingestion failure.
    }
    throw error;
  }
  return {
    path: "",
    scanned: data.records.length,
    inserted,
    duplicates: data.records.length - inserted,
    legacy: data.legacyRecords,
    malformed: data.malformedLines,
    lastSyncAt,
  };
}

async function synchronize(
  agentDir: string,
  replace: boolean,
  loader: SqliteLoader,
): Promise<MetricsSqliteSyncResult> {
  const path = configuredPath(agentDir);
  const module = await loadSqlite(loader);
  const data = readMetricsRecords(agentDir);
  let db: DatabaseSync | null = null;
  try {
    db = openCompatible(module, path, true);
    return { ...ingest(db, data, replace), path };
  } catch (error) {
    if (error instanceof MetricsSqliteError) throw error;
    throw new MetricsSqliteError(
      "sqlite_sync_failed",
      `Cannot synchronize metrics database: ${message(error)}`,
    );
  } finally {
    try {
      db?.close();
    } catch {
      // The committed JSON source remains authoritative.
    }
  }
}

export async function syncMetricsSqlite(
  agentDir: string,
  loader: SqliteLoader = loadDefault,
): Promise<MetricsSqliteSyncResult> {
  return synchronize(agentDir, false, loader);
}

export async function rebuildMetricsSqlite(
  agentDir: string,
  confirmed: boolean,
  loader: SqliteLoader = loadDefault,
): Promise<MetricsSqliteSyncResult> {
  if (!confirmed) {
    throw new MetricsSqliteError(
      "sqlite_confirmation_required",
      "Database rebuild requires the exact confirmation token",
    );
  }
  return synchronize(agentDir, true, loader);
}

export async function readMetricsSqlite(
  agentDir: string,
  loader: SqliteLoader = loadDefault,
): Promise<MetricsSqliteReadResult> {
  const path = configuredPath(agentDir);
  const module = await loadSqlite(loader);
  let db: DatabaseSync | null = null;
  try {
    db = openCompatible(module, path, false);
    const rows = db
      .prepare("SELECT payload FROM events ORDER BY timestamp, record_id")
      .all() as Array<{ payload?: unknown }>;
    const records: MetricsRecord[] = [];
    let malformedLines = 0;
    for (const row of rows) {
      try {
        const value: unknown = JSON.parse(String(row.payload ?? ""));
        const record = parseMetricsRecordValue(value);
        if (record) records.push(record);
        else malformedLines += 1;
      } catch {
        malformedLines += 1;
      }
    }
    const lastSync = metadataValue(db, "last_sync_at");
    return {
      records,
      malformedLines,
      rows: rows.length,
      lastSyncAt: lastSync == null ? null : numberValue(Number(lastSync)),
      path,
    };
  } catch (error) {
    if (error instanceof MetricsSqliteError) throw error;
    throw new MetricsSqliteError(
      "sqlite_read_failed",
      `Cannot read metrics database: ${message(error)}`,
    );
  } finally {
    try {
      db?.close();
    } catch {
      // Read failures do not alter JSON collection.
    }
  }
}

export function detachMetricsSqlite(agentDir: string): string | null {
  const path = readMetricsConfig(agentDir).sqlitePath ?? null;
  setMetricsSqlitePath(agentDir, null);
  return path;
}

export async function destroyMetricsSqlite(
  agentDir: string,
  confirmed: boolean,
  loader: SqliteLoader = loadDefault,
): Promise<{ path: string; deleted: boolean }> {
  if (!confirmed) {
    throw new MetricsSqliteError(
      "sqlite_confirmation_required",
      "Database destroy requires the exact confirmation token",
    );
  }
  const path = configuredPath(agentDir);
  const module = await loadSqlite(loader);
  if (!existsSync(path)) {
    setMetricsSqlitePath(agentDir, null);
    return { path, deleted: false };
  }
  let db: DatabaseSync | null = null;
  try {
    db = openCompatible(module, path, true);
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.close();
    db = null;
    rmSync(path);
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
    setMetricsSqlitePath(agentDir, null);
    return { path, deleted: true };
  } catch (error) {
    if (error instanceof MetricsSqliteError) throw error;
    throw new MetricsSqliteError(
      "sqlite_destroy_failed",
      `Cannot destroy metrics database: ${message(error)}`,
    );
  } finally {
    try {
      db?.close();
    } catch {
      // Preserve the primary destroy error.
    }
  }
}
