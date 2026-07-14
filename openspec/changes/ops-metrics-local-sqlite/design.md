## Context

Lifecycle metrics currently append schema-v1 metadata records to one JSONL file per Pi session under the user-local agent directory. This is intentionally a minimal, fail-open collection path, but records have no stable event identifier or repository/workspace dimension, and JSONL is inconvenient for repeated ingestion and SQL analysis. The package supports Node >=20, while the current Pi runtime uses Node 24 and exposes `node:sqlite`.

The operator wants JSONL retained and an optional, explicitly created SQLite database that can centralize records from local workspaces or agent directories on the same machine. Existing constraints remain: disabled by default, metadata-only, no network, no model/tool exposure, and no lifecycle behavior changes on observability failure.

## Goals / Non-Goals

**Goals:**

- Keep JSONL as the append-only source of truth and collection hot path.
- Add stable record identity and privacy-preserving workspace identity before central aggregation.
- Let an operator explicitly initialize or attach one local SQLite projection and idempotently ingest retained JSONL.
- Make the projection inspectable, rebuildable, detachable, and explicitly destroyable without coupling it to JSON reset.
- Preserve core Node 20 compatibility by dynamically feature-detecting `node:sqlite`.
- Reuse existing report aggregation for an explicitly selected SQLite source.

**Non-Goals:**

- Remote endpoints, HTTP collectors, telemetry upload, authentication, or retry queues.
- Concurrent writes to one SQLite file over NFS/SMB/cloud-synced filesystems.
- Replacing JSONL collection with direct per-turn database writes.
- Automatically creating, synchronizing, rebuilding, or deleting a database.
- Reconstructing unknown legacy workspace attribution.
- Arbitrary SQL execution through Pi commands.

## Decisions

### JSONL remains authoritative; SQLite is a derived projection

Every metrics event continues to append only to its session JSONL file. `/ops-metrics db sync` scans retained JSONL and inserts records into SQLite in a short transaction. Database failure therefore cannot lose the source record or alter a lifecycle action. Re-running sync is safe.

Direct dual-write was rejected because partial JSON/SQLite failures and SQLite lock contention would enter the model-turn hot path. Deleting JSON after sync was rejected because it would make the optional projection authoritative and prevent simple rebuilds.

### Schema-v2 records carry `recordId` and nullable `workspaceId`

New records use metrics schema version 2, a random UUID `recordId`, and a `workspaceId` derived mechanically from a SHA-256 hash of the resolved primary Git common directory/root. Linked worktrees of one repository therefore share an identity without persisting an absolute path. If a repository identity cannot be resolved, `workspaceId` remains null rather than being inferred.

The reader accepts schema-v1 records and normalizes them in memory. A deterministic legacy record ID is derived from session file identity, line number, and original line bytes; legacy `workspaceId` remains null. This provides idempotent ingestion while preserving unknown attribution.

### SQLite is explicit and locally configured

`/ops-metrics db init` creates and attaches the default database at `<agentDir>/openspec-ops/metrics.sqlite3`. An optional absolute local path selects another database. Relative paths are rejected to avoid workspace-dependent resolution. A compatible existing openspec-ops metrics database is attached without truncation; an unrecognized or incompatible database is refused.

The metrics config retains `enabled` independently from an optional absolute `sqlitePath`. Enabling/disabling JSON collection never creates, attaches, syncs, or deletes SQLite. Detach removes only the configured path. Destroy requires the exact `confirm` token, validates that the target is an openspec-ops metrics database, closes it, removes database/WAL/SHM files, and detaches it.

### SQLite is a raw event index with stable metadata

The database records its application/schema identity and stores one row per record:

- `record_id` primary key
- record schema version and timestamp
- kind, workspace ID, session hash, change, and action columns for indexing
- canonical JSON payload containing the normalized metadata record

`INSERT OR IGNORE` makes a full rescan idempotent. Sync reports scanned, inserted, duplicate, invalid/read-warning, and legacy counts. JSONL files are never modified. WAL mode, a bounded busy timeout, parameterized statements, and short transactions support local multi-process use; network filesystems remain unsupported.

A database schema version is independent from the JSON record schema version. Unknown future DB versions are refused instead of silently modified.

### Database reports are explicit and never silently stale the default report

Existing `/ops-metrics report [change]` continues to read JSONL. `/ops-metrics report --source sqlite [change]` reads normalized payloads from the configured database and runs the same aggregation/formatting functions. The heading identifies the source. The command does not implicitly sync, so `db status` and report output expose the last successful sync time/row count when available.

This avoids changing existing reports and makes projection staleness visible. No arbitrary SQL is exposed to the model or slash command.

### Rebuild and reset have separate destructive boundaries

`/ops-metrics reset confirm` continues to delete JSONL only. `/ops-metrics db rebuild confirm` clears and re-ingests the compatible configured projection from retained JSONL. `/ops-metrics db destroy confirm` deletes only the configured compatible database. Neither operation changes collection enablement.

### `node:sqlite` is feature-detected

The adapter dynamically imports `node:sqlite` only for DB operations. If unavailable, `db status` reports the feature as unavailable and DB mutations fail clearly; JSON collection, JSON reporting, and lifecycle commands continue unchanged. A native third-party SQLite dependency is not added.

## Risks / Trade-offs

- **Node 20 may not expose `node:sqlite`.** → Feature-gate only SQLite and preserve all JSON behavior; document the runtime requirement instead of adding a mandatory native dependency.
- **A chosen database can become stale.** → Never auto-select it for existing reports; show sync metadata and require explicit sync/source selection.
- **Two processes can sync concurrently.** → Use WAL, busy timeout, one short transaction, and primary-key deduplication; failures remain retryable.
- **A database on a network/cloud filesystem may have unsafe locking.** → Scope support to local filesystems and document the limitation; no remote sender is added.
- **Legacy records lack repository identity.** → Store null/legacy-unknown and never infer attribution from unrelated Pi session content.
- **Hashing an absolute repository root is machine-local.** → Accept this deliberately: the change centralizes one machine, not cross-machine clones.
- **Rebuild can temporarily leave an empty projection if ingestion fails.** → JSONL remains intact and rebuild is explicit/retryable; report the failure without affecting lifecycle work.

## Migration Plan

1. Readers accept both schema-v1 and schema-v2 JSONL; writers begin emitting schema-v2.
2. Existing config files containing only `enabled` remain valid with no SQLite attachment.
3. No database appears during package update, metrics enablement, collection, or reporting.
4. Operators explicitly run `db init` followed by `db sync` when desired.
5. Rollback removes/detaches the optional database; schema-v2 JSON remains metadata-only and future readers retain backward parsing support.

## Open Questions

None for this change. Remote transfer and cross-machine identity remain separate future work.
