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
The system SHALL treat worktree alignment as **required** when the `openspec-ops` binary is resolvable and the operator is orchestrating a named change that has (or is being given) an openspec-ops worktree via explicit `openspec-ops start` / `/ops-start` (or equivalent).

The system SHALL NOT require worktree alignment when `openspec-ops` cannot be resolved, or when no change worktree exists and the operator has not started one; orchestration MAY continue on the primary checkout only after an **explicit warning** that worktree alignment is skipped.

The system MUST NOT use `OPENSPEC_OPS_AUTO_START` (or any `OPENSPEC_OPS_AUTO_*` variable) as a live policy switch; those environment variables are retired.

#### Scenario: alignment required when ops resolvable and worktree in use
- **WHEN** `openspec-ops` is resolvable
- **AND** a change worktree path is known (after start or where found)
- **THEN** worktree alignment is required for named propose/apply orchestration for that change

#### Scenario: no worktree opts out with warning
- **WHEN** no change worktree exists and the operator proceeds without start
- **AND** propose/apply orchestration continues on primary
- **THEN** instructions require an explicit warning that worktree alignment is skipped

#### Scenario: AUTO_START is not a policy switch
- **WHEN** documentation or specs describe alignment policy after this change
- **THEN** they do not require reading `OPENSPEC_OPS_AUTO_START` to decide alignment

---

### Requirement: Package propose orchestration resolves workspace before writes
Worktree alignment for propose MUST NOT require the openspec-ops Pi package to export a skill named `openspec-propose` or a prompt named `opsx-propose`.

Valid mechanisms: extension constraints, opt-in intercept, doctor diagnostics, and a **documentation snippet** for consumers to merge into **their own** propose skill after `openspec update`.

This version does not require shipping an `ops-propose` package skill; if a future orchestrator is added, it MUST use an **ops-*** name and MUST NOT be named `openspec-propose`.

#### Scenario: package does not require openspec-propose export for alignment
- **WHEN** implementing worktree write alignment for package consumers
- **THEN** success criteria do not depend on `pi.skills` including `openspec-propose`

#### Scenario: snippet is an allowed alignment mechanism
- **WHEN** documenting consumer alignment without package openspec-propose
- **THEN** a paste-in snippet path (e.g. under `docs/snippets/`) is an accepted mechanism

### Requirement: Extension hard write-path constraint after ensure
After a successful **explicit** worktree start (or where-found workspace bind) for change `C` at path `W`, the Pi extension SHALL inject a message that **requires** subsequent openspec and implementation writes for that change to use `W`, not a soft optional hint alone.

The extension MUST NOT claim the process cwd was switched unless it was.
The extension MUST NOT depend on auto-ensure-on-propose to inject this constraint.

#### Scenario: start success injects REQUIRED path
- **WHEN** `/ops-start` (or equivalent explicit start) succeeds for change `add-dark-mode` at path `W`
- **THEN** the handoff includes a hard constraint naming `W` as the write root

---

### Requirement: Doctor or docs verify intercept and CLI resolution
Documentation and doctor (or equivalent) SHALL help verify `openspec-ops` resolution and whether `openspec` appears to be `openspec-ops-intercept` when intercept is intended, including `OPENSPEC_REAL_BIN` guidance (and any remaining intercept docs). Guidance MUST NOT instruct operators to use `OPENSPEC_OPS_AUTO_START` as a live alignment switch.

Doctor SHOULD warn if the propose skill marker block is missing after an OpenSpec skill regen.

#### Scenario: README documents alignment and intercept verification
- **WHEN** reading the root README after this change
- **THEN** it describes start ≠ silent chdir, skill cwd binding, explicit-start alignment (not AUTO_START=off), and intercept verify if still relevant

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

---

### Requirement: Apply orchestration binds implementation to workspace path
Package-shipped apply-related skills/prompts and/or harness gates SHALL, once a change name is known and a workspace exists, direct implementation file writes and OpenSpec CLI calls for that change to use the worktree path from `openspec-ops where`/`start`.

#### Scenario: apply path uses where result
- **WHEN** apply orchestration knows change `add-dark-mode`
- **AND** `openspec-ops where add-dark-mode` succeeds with path `W`
- **THEN** instructions or harness handoff require using `W` for implementation writes for that change

### Requirement: Default delivery order is merge before archive
Documentation for worktree alignment and the overall loop SHALL state that the default git delivery order is merge into main **before** OpenSpec archive, and that archive-before-merge is not the default.

#### Scenario: docs do not default to archive-before-merge
- **WHEN** reading worktree loop / alignment documentation after this change
- **THEN** the default sequence places merge before archive

---

### Requirement: Path alignment does not create submodule branches
Worktree write alignment (ensure, REQUIRED path inject, snippets) SHALL document that directing writes into the worktree path does **not** create feature branches inside git submodules, and that agents remain responsible for submodule branch/commit hygiene when `.gitmodules` is present.

#### Scenario: snippet or docs mention submodule identity gap
- **WHEN** reading worktree alignment documentation after this change
- **THEN** it states that path alignment alone does not put submodules on a change branch
