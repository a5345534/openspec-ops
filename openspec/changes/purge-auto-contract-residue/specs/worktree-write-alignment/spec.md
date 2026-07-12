## MODIFIED Requirements

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

### Requirement: Extension hard write-path constraint after ensure
After a successful **explicit** worktree start (or where-found workspace bind) for change `C` at path `W`, the Pi extension SHALL inject a message that **requires** subsequent openspec and implementation writes for that change to use `W`, not a soft optional hint alone.

The extension MUST NOT claim the process cwd was switched unless it was.
The extension MUST NOT depend on auto-ensure-on-propose to inject this constraint.

#### Scenario: start success injects REQUIRED path
- **WHEN** `/ops-start` (or equivalent explicit start) succeeds for change `add-dark-mode` at path `W`
- **THEN** the handoff includes a hard constraint naming `W` as the write root

### Requirement: Doctor or docs verify intercept and CLI resolution
Documentation and doctor (or equivalent) SHALL help verify `openspec-ops` resolution and whether `openspec` appears to be `openspec-ops-intercept` when intercept is intended, including `OPENSPEC_REAL_BIN` guidance (and any remaining intercept docs). Guidance MUST NOT instruct operators to use `OPENSPEC_OPS_AUTO_START` as a live alignment switch.

Doctor SHOULD warn if the propose skill marker block is missing after an OpenSpec skill regen.

#### Scenario: README documents alignment and intercept verification
- **WHEN** reading the root README after this change
- **THEN** it describes start ≠ silent chdir, skill cwd binding, explicit-start alignment (not AUTO_START=off), and intercept verify if still relevant
