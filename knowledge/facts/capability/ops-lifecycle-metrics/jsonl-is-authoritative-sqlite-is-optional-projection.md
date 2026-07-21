---
name: "JSONL is authoritative; SQLite is optional projection"
description: "Lifecycle metrics append to local JSONL; SQLite is explicitly initialized and synchronized as a rebuildable local projection."
type: architectural-invariant
scope: capability:ops-lifecycle-metrics
verified_at: 2026-07-21
source: agent:compact-producer
---

## Metrics storage architecture

Lifecycle metrics use per-session JSONL under the Pi agent directory as the **append-only source of truth**. SQLite is an optional, local, derived projection:

- SQLite is never created by enabling metrics, collecting a turn, updating the package, or running an ordinary JSONL report.
- Operators explicitly run `db init` and `db sync`.
- Synchronization is idempotent; JSONL remains retained and can rebuild the database.
- `/ops-metrics reset confirm` deletes JSONL records only; database rebuild/destroy have separate confirmations.
- SQLite failures are fail-open and cannot block lifecycle actions.
- No remote transfer, network telemetry, or extra model call is involved.

This was implemented and merged in PR #27 (`ops-metrics-local-sqlite`) and archived into the `ops-lifecycle-metrics` specification.

## Evidence

- Conversation decision: “JSONL 是不可變、可重建的原始事件；SQLite 是使用者選擇建立的集中查詢層。”
- Merged PR #27 added explicit `db init|sync|rebuild|detach|destroy` and SQLite-backed reports.
- End-to-end tests verified idempotent init→sync→dedupe→read→destroy and that report commands trigger zero agent/model events.

## Why this is shared

This is the core storage boundary for all future metrics work; violating it would introduce dual-write inconsistency or put SQLite failures on the lifecycle hot path.
