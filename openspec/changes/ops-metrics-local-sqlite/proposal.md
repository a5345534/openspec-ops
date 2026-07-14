## Why

The local JSONL metrics ledger is durable and fail-open, but it is not a convenient query/index layer and its records cannot yet be safely deduplicated or separated by workspace when aggregated. Operators need an explicit, local-only way to create a SQLite projection and ingest retained JSONL records without moving collection onto a database hot path.

## What Changes

- Add stable `recordId` and privacy-preserving `workspaceId` fields to newly collected metrics records, while continuing to read legacy schema-v1 JSONL as unattributed legacy workspace data.
- Add an optional local SQLite projection that is never created implicitly and uses retained JSONL as its source of truth.
- Add operator-only `/ops-metrics db` commands to inspect SQLite availability/state, initialize or attach a database, idempotently sync JSONL, rebuild the projection, detach it, and explicitly destroy it.
- Allow reports to read an explicitly synchronized SQLite projection while preserving JSONL as the default report source.
- Keep SQLite feature-gated when the current Node runtime lacks `node:sqlite`; JSONL collection and reporting continue normally on supported core runtimes.
- Preserve local-only, metadata-only, no-extra-model, no-network, and lifecycle fail-open guarantees. No automatic per-turn database writes or remote sender is introduced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ops-lifecycle-metrics`: Add workspace/record identity and an explicitly created, local SQLite projection with idempotent JSONL ingestion and scoped lifecycle management.

## Impact

- Metrics record types, validation, storage, aggregation, and extension command handling under `src/lifecycle-metrics/` and `.pi/extensions/openspec-ops-guided.ts`.
- Local metrics configuration gains optional SQLite attachment metadata.
- Tests and documentation cover identity, legacy ingestion, idempotency, database lifecycle, compatibility, privacy, and fail-open behavior.
- No mandatory runtime dependency is added; SQLite is optional and dynamically uses `node:sqlite` when available.
