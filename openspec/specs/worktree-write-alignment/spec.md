# worktree-write-alignment Specification

## Purpose

Align OpenSpec change artifact writes with openspec-ops worktrees after ensure (skill cwd binding, fail-closed rules, extension/doctor/docs).

## Requirements

### Requirement: Active change artifacts belong in the change worktree
When an openspec-ops workspace exists for change `C` at path `W`, the system’s documented and implemented orchestration paths SHALL direct OpenSpec planning artifact creation for `C` to `W` (under `W/openspec/changes/C/`), not solely the primary checkout.

The system MUST document that ensure/start does **not** by itself change the agent process working directory.

#### Scenario: Documented ensure vs write path
- **WHEN** a user reads project documentation for auto-ensure or start
- **THEN** documentation states that ensure/start creates or reuses a worktree and that propose/write steps must use the worktree path explicitly

#### Scenario: Aligned propose uses worktree for scaffold
- **WHEN** orchestration has a known change name `C` and `openspec-ops where C` succeeds with path `W`
- **AND** the package propose orchestration path is followed
- **THEN** subsequent `openspec new change` / artifact writes for `C` are performed with working directory `W` (or equivalent path binding)

---

### Requirement: When worktree alignment is required
Worktree alignment is **required** when the `openspec-ops` binary is resolvable and `OPENSPEC_OPS_AUTO_START` is not `off`.

Worktree alignment is **not required** when `OPENSPEC_OPS_AUTO_START=off` or `openspec-ops` cannot be resolved; orchestration MAY continue on primary only after an explicit warning.

#### Scenario: alignment required uses AUTO_START not off
- **WHEN** `openspec-ops` is resolvable
- **AND** `OPENSPEC_OPS_AUTO_START` is unset or not `off`
- **THEN** worktree alignment is required for named propose orchestration

#### Scenario: AUTO_START off opts out with warning
- **WHEN** `OPENSPEC_OPS_AUTO_START=off`
- **AND** propose orchestration proceeds without a worktree
- **THEN** instructions require an explicit warning that worktree alignment is skipped

---

### Requirement: Package propose orchestration resolves workspace before writes
Package-shipped propose skills/prompts SHALL, once a kebab-case change name is known:

1. Resolve workspace via `openspec-ops where` and/or `start` with `--json`
2. Use `result.path` as cwd for OpenSpec CLI and for files under `openspec/changes/<name>/`
3. If alignment is required and where/start hard-fails: **stop** with an explicit error (fail-closed)
4. If alignment is not required and workspace is missing: may continue on primary **with warning**

Ops-specific steps MUST be wrapped in durable markers:

`<!-- openspec-ops:worktree-alignment BEGIN -->` … `<!-- openspec-ops:worktree-alignment END -->`

#### Scenario: where success binds cwd
- **WHEN** propose orchestration knows change `add-dark-mode`
- **AND** `openspec-ops where add-dark-mode --json` returns ok with path `W`
- **THEN** instructions require using `W` as cwd for scaffold/write steps

#### Scenario: missing worktree fails closed when alignment required
- **WHEN** alignment is required
- **AND** where/start fails
- **THEN** the agent is instructed to stop and report the failure
- **AND** not treat primary-only scaffold as success

#### Scenario: skill contains alignment marker block
- **WHEN** reading the package propose skill after this change
- **THEN** it contains the `openspec-ops:worktree-alignment` BEGIN/END markers around ops binding steps

---

### Requirement: Extension hard write-path constraint after ensure
After successful auto-ensure for change `C` at path `W`, the Pi extension SHALL inject a message that **requires** subsequent openspec and implementation writes for that change to use `W`, not a soft optional hint alone.

The extension MUST NOT claim the process cwd was switched unless it was.

#### Scenario: ensure success injects REQUIRED path
- **WHEN** auto-ensure succeeds for change `add-dark-mode` at path `W`
- **THEN** the handoff includes a hard constraint naming `W` as the write root

---

### Requirement: Doctor or docs verify intercept and CLI resolution
Documentation and doctor (or equivalent) SHALL help verify `openspec-ops` resolution and whether `openspec` appears to be `openspec-ops-intercept` when intercept is intended, including `OPENSPEC_REAL_BIN` / `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE` guidance.

Doctor SHOULD warn if the propose skill marker block is missing after an OpenSpec skill regen.

#### Scenario: README documents alignment and intercept verification
- **WHEN** reading the root README after this change
- **THEN** it describes ensure ≠ cwd, skill cwd binding, fail-closed vs AUTO_START=off, and intercept enable/verify

---

### Requirement: No silent primary-only success for name-less propose intent
When propose-intent is detected without a parseable change name, the system MUST NOT claim ensure completed for a concrete change, and SHOULD surface that alignment waits until a name exists.

#### Scenario: propose without name does not claim ensure done
- **WHEN** input is `/opsx-propose` with no kebab name
- **THEN** the system does not report successful ensure for a concrete change name

---

### Requirement: No automatic primary-to-worktree migration in v1
The system MUST NOT automatically move or delete primary `openspec/changes/<name>` into the worktree as part of ensure/propose happy path in this version.

#### Scenario: dual trees left to operator
- **WHEN** both primary and worktree have change directories for the same name
- **THEN** the system may warn but does not auto-merge or auto-delete in v1
