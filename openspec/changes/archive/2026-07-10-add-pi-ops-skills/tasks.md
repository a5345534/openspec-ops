## 1. Shared content preparation

- [x] 1.1 Author the canonical Shared runtime rules block (binary resolve, `--json`, schemaVersion 1, exit table, envelopes, hard guardrails, fixed phrases base)
- [x] 1.2 Author per-command step blocks for start / where / finish / doctor (including finish confirmations and start next-step policy)

## 2. Skills

- [x] 2.1 Write `.pi/skills/ops-start/SKILL.md` (frontmatter + full shared rules + start steps + fixed phrases)
- [x] 2.2 Write `.pi/skills/ops-where/SKILL.md` (full self-contained)
- [x] 2.3 Write `.pi/skills/ops-finish/SKILL.md` (full self-contained; dirty/force consent; not-archive)
- [x] 2.4 Write `.pi/skills/ops-doctor/SKILL.md` (full self-contained; no auto-fix)

## 3. Prompts (full-text self-contained)

- [x] 3.1 Write `.pi/prompts/ops-start.md` with `$@` input binding and the same operational capability as the start skill (not a short forwarder)
- [x] 3.2 Write `.pi/prompts/ops-where.md` full-text self-contained
- [x] 3.3 Write `.pi/prompts/ops-finish.md` full-text self-contained
- [x] 3.4 Write `.pi/prompts/ops-doctor.md` full-text self-contained

## 4. Consistency and docs

- [x] 4.1 Diff skill↔prompt pairs and ensure shared rules + exit handling are not weaker in either side
- [x] 4.2 Update root `README.md` with Pi `/ops-start` → `/opsx-*` → `/ops-finish` mapping, `OPENSPEC_OPS_BIN`, and dual-maintenance note
- [x] 4.3 Confirm no new asset uses `opsx-` prefix and existing OpenSpec skills/prompts are untouched

## 5. Verification

- [x] 5.1 Checklist: each of 8 files includes binary resolve, `--json`, exit table, and OpenSpec boundary guardrails
- [x] 5.2 Manual read-through of finish skill/prompt for force-consent and “not archive” language
- [x] 5.3 Optional smoke: with CLI on PATH, mentally/walk `/ops-start` instructions against `openspec-ops start --help` flags
