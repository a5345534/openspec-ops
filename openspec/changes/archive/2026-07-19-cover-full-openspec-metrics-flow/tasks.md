## 1. Activity Taxonomy and Recognition

- [x] 1.1 Decouple metrics activities from `NextActionId` and add `opsx-explore` plus `opsx-sync` to validated action types.
- [x] 1.2 Implement pure raw-slash and expanded stock OpenSpec signature recognition with conservative change extraction.
- [x] 1.3 Bind supported signatures to vendored OpenSpec prompt/skill fixtures and fail unknown on drift or ambiguity.

## 2. Runtime Attribution

- [x] 2.1 Seed invocation context from recognized operator input without retaining prompt text or arguments.
- [x] 2.2 Preserve deterministic marker, shell, input, and unknown precedence across model/tool-loop turns.
- [x] 2.3 Reset activity at `agent_settled` and verify later ordinary messages do not inherit stale explore context.
- [x] 2.4 Keep helper CLI calls subordinate while covering recognized autonomous stage commands and markers.
- [x] 2.5 Preserve extension-owned `/ops-deliver` as the only creator of deliver reliability attempts.

## 3. Storage, Reports, and Documentation

- [x] 3.1 Update JSONL validation, SQLite ingestion, and report aggregation tests for new activities and legacy compatibility.
- [x] 3.2 Document full-flow coverage, autonomous execution behavior, invocation boundaries, unknown fallback, and deliver-attempt distinction.

## 4. Verification

- [x] 4.1 Add targeted tests for raw and expanded explore/propose/apply/sync/archive, ambiguous prose, change-null behavior, precedence, and reset semantics.
- [x] 4.2 Run typecheck, build, targeted tests, full tests, OpenSpec validation, and diff checks.
