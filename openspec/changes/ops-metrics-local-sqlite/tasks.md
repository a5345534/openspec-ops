## 1. Record Identity and Compatibility

- [x] 1.1 Introduce schema-v2 metrics records with UUID `recordId` and nullable hashed `workspaceId` fields across all record kinds.
- [x] 1.2 Resolve one privacy-preserving workspace identity for a primary Git repository so linked worktrees share it and unresolved repositories remain unknown.
- [x] 1.3 Extend JSONL reading to normalize valid schema-v1 records with deterministic legacy IDs, unknown workspace identity, and unchanged malformed-record warnings.
- [x] 1.4 Extend metrics configuration without losing the independent enabled flag or an optional absolute SQLite attachment path.

## 2. Optional SQLite Projection

- [x] 2.1 Add a dynamically loaded `node:sqlite` adapter with availability status, compatible database identity/version checks, local path validation, secure creation, WAL, and bounded busy timeout.
- [x] 2.2 Implement explicit default/custom database initialization and compatible existing-database attachment without implicit JSONL ingestion or overwrite.
- [x] 2.3 Implement transactional idempotent JSONL synchronization with inserted/duplicate/legacy/warning counts and retained source files.
- [x] 2.4 Implement SQLite record reading and explicit SQLite-backed reporting through the existing mechanical report builder, including source and sync-state output.
- [x] 2.5 Implement confirmed rebuild and destroy plus non-destructive detach, keeping JSONL and collection enablement independent.

## 3. Pi Operator Controls

- [x] 3.1 Extend `/ops-metrics` parsing and direct command handling for `db status|init|sync|rebuild|detach|destroy` and `report --source sqlite [change]` without agent follow-ups.
- [x] 3.2 Keep ordinary on/off/status/report/export/reset behavior backward compatible, ensure reset never modifies SQLite, and surface database failures as non-blocking local notices.

## 4. Verification and Documentation

- [x] 4.1 Add tests for workspace identity, schema-v1 normalization, stable legacy deduplication, schema-v2 JSON round trips, and configuration migration.
- [x] 4.2 Add SQLite tests for explicit creation, no implicit DB, custom-path safety, incompatible-file protection, idempotent sync, malformed lines, explicit reports, rebuild, detach, destroy, and feature-unavailable behavior.
- [x] 4.3 Add extension-level tests or smoke coverage proving database commands make no model/network call and lifecycle behavior remains fail-open.
- [x] 4.4 Document the JSON-source/SQLite-projection model, commands, runtime requirement, staleness, privacy, reset boundaries, and local-filesystem-only limitation.
- [x] 4.5 Run OpenSpec validation, typechecks, extension smoke/typecheck, full tests, build, package dry-run, and diff hygiene checks.
