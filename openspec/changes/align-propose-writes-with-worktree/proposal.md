## Why

`openspec-ops start` / auto-ensure can create a change worktree while OpenSpec propose still scaffolds under the **primary** repo (`openspec/changes/<name>/`), because ensure does not change agent cwd and stock propose skills resolve the OpenSpec root from process cwd. Operators experience this as “worktree was not opened.” GitHub issue [#1](https://github.com/a5345534/openspec-ops/issues/1) documents the gap. We need a closed product contract: **after ensure, planning artifacts for change C live under worktree W**, without forking OpenSpec.

## What Changes

- **Product contract (W-only for active change artifacts):** When a workspace exists for change `C` at path `W`, OpenSpec planning artifacts for `C` MUST be written under `W/openspec/changes/C/` (not only primary). Document that **ensure ≠ agent cwd**.
- **P0 — Skill/prompt contract:** Update shipped `openspec-propose` / `opsx-propose` (and apply) with a durable **`openspec-ops:worktree-alignment` marker block**: once name known → `where`/`start` → cwd=`path` for openspec + change writes. **Fail-closed** when alignment is required and workspace missing; **warn-and-allow primary** only when worktree automation is explicitly opted out (`OPENSPEC_OPS_AUTO_START=off`) or ops CLI is intentionally unused.
- **Resilience to `openspec update`:** Marker block + doctor/README check so regen does not silently drop alignment steps.
- **P1 — Extension handoff:** After successful ensure, inject **REQUIRED** write-path constraint with absolute `W`. Propose without kebab name: visible deferred-ensure notice (no false ensure success).
- **P1 — Doctor/docs:** Verify ops bin; warn if `openspec` is not intercept when intercept is the intended path; `OPENSPEC_REAL_BIN` guidance.
- **P2 — Tests/smoke:** ensure → propose-with-cwd → change under worktree.
- No OpenSpec source fork; no auto-migrate dual trees in v1; no default global `openspec` bin hijack.

## Capabilities

### New Capabilities
- `worktree-write-alignment`: W-only write contract, skill binding, fail-closed rules, marker-block resilience, extension/doctor/docs

### Modified Capabilities
- `pi-auto-ensure-on-propose`: Hard write-path inject; deferred-ensure notice without name
- `openspec-cli-intercept`: Doctor/docs verification of intercept on PATH
- `pi-ops-skills`: Propose/apply orchestration binds to `where.path`; marker-block guidance

## Impact

- **Closes issue #1** when package skills (or intercept) are the active path
- **Risk:** upstream-only skills without package copy; agent ignore—mitigate fail-closed + doctor
- **Escape:** `OPENSPEC_OPS_AUTO_START=off` allows primary-only with warning
