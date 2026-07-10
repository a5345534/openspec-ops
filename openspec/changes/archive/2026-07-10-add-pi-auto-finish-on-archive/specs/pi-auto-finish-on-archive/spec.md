## ADDED Requirements

### Requirement: Harness orphan-reclaim gate without forking OpenSpec archive
The system SHALL provide a Pi extension path that reclaims openspec-ops worktrees when a watched change is no longer active, and MUST NOT replace or reimplement the OpenSpec archive workflow.

When archive-intent input is used only to arm a watch, the extension MUST release the original user input so the stock `/opsx-archive` (or equivalent) path expands and runs as it would without the extension.

The extension MUST NOT require modifications to OpenSpec CLI archive commands or the semantic steps of moving a change into the archive directory.

Worktree cleanup side effects MUST be performed by invoking the `openspec-ops` CLI (`finish` / `where`) with `--json`, not by reimplementing git worktree removal in the extension and not by requiring the `ops-finish` skill as the automation executor.

#### Scenario: Stock archive proceeds after watch arm
- **WHEN** the user submits an archive-intent command with a parseable change name and finish policy is not `off`
- **THEN** the original archive input is allowed to continue to OpenSpec archive expansion/handling
- **AND** the extension does not itself move OpenSpec change artifacts to archive

#### Scenario: Policy off leaves archive untouched
- **WHEN** finish policy is `off`
- **AND** the user submits `/opsx-archive <change>`
- **THEN** the extension performs no worktree finish side effects for that input
- **AND** archive proceeds as without the gate

#### Scenario: Automation does not require ops-finish skill
- **WHEN** the extension performs orphan worktree cleanup
- **THEN** it invokes `openspec-ops finish` (and `where` as needed) via the CLI
- **AND** it does not depend on loading or expanding the `ops-finish` skill for the happy path

---

### Requirement: Detect archive intent with strong signals only for watch arm
The extension SHALL treat input as archive-intent for **watch arming** only for strong slash forms, including at least:

- `/opsx-archive` at the start of input (optional args after)
- `/opsx:archive` at the start of input if supported in the environment

The extension MUST NOT treat bare-word chat containing “archive” as archive-intent for this capability.

Archive-intent alone MUST NOT be treated as authorization to finish; finish requires orphan hard conditions defined in this spec.

#### Scenario: opsx-archive is detected for watch
- **WHEN** the user input begins with `/opsx-archive`
- **AND** finish policy is not `off`
- **AND** a valid change name is parsed
- **THEN** the extension may arm a watch for that change

#### Scenario: propose is not detected as archive watch
- **WHEN** the user input begins with `/opsx-propose`
- **THEN** the extension does not arm a finish watch for that input as part of this capability

---

### Requirement: Parse change name conservatively before arming watch
When archive-intent is detected, the extension SHALL attempt to parse a change name from the arguments.

If the first argument matches kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$`, the extension MUST use it as the watched change name.

If no valid change name can be parsed, the extension MUST NOT arm a watch and MUST allow archive to continue.

#### Scenario: Kebab-case name arms watch
- **WHEN** input is `/opsx-archive add-dark-mode`
- **AND** finish policy is `ask` or `on`
- **THEN** the extension arms a watch for `add-dark-mode`

#### Scenario: Missing name does not arm watch
- **WHEN** input is `/opsx-archive` with no change name argument
- **AND** finish policy is `ask` or `on`
- **THEN** the extension does not arm a watch
- **AND** archive input is still released/continued

---

### Requirement: Default policy ask with on and off options
The extension SHALL support finish policy values `ask`, `on`, and `off`.

The default policy MUST be `ask` when no override is set.

Policy MUST be readable from environment variable `OPENSPEC_OPS_AUTO_FINISH` with values `ask`|`on`|`off` (case-insensitive).

The value `on` MUST be implemented in this capability (not deferred): when orphan hard conditions hold, finish runs without user confirmation.

The `openspec-ops` CLI MUST NOT be required to implement this policy flag.

#### Scenario: Default is ask
- **WHEN** `OPENSPEC_OPS_AUTO_FINISH` is unset
- **THEN** the extension behaves as policy `ask`

#### Scenario: Off disables finish gate side effects
- **WHEN** `OPENSPEC_OPS_AUTO_FINISH=off`
- **THEN** archive-intent input does not lead to post-settle `openspec-ops finish` side effects

#### Scenario: On finishes without confirm when orphan hard conditions hold
- **WHEN** policy is `on`
- **AND** settle evaluation finds orphan hard conditions hold for a watched change
- **THEN** the extension runs `openspec-ops finish <change> --json` without asking for confirmation
- **AND** does not pass `--force`

---

### Requirement: Act at settle check points with sticky watch not one-shot archive finish
The extension MUST NOT run `openspec-ops finish` during the `input` handler for archive-intent.

When a watch is armed, the extension SHALL re-evaluate orphan conditions after agent runs settle while the watch remains, and MUST NOT clear the watch solely because settle fired while the change is still active.

#### Scenario: Finish is not invoked at input time
- **WHEN** the user submits `/opsx-archive add-dark-mode` with policy `ask`
- **THEN** the extension does not call `openspec-ops finish` before releasing the archive input

#### Scenario: Still-active change keeps watch and does not finish
- **WHEN** a watch is armed for `add-dark-mode`
- **AND** settle evaluation runs
- **AND** `where` reports the worktree exists
- **AND** the change is still active (`changeDirExists` is true)
- **THEN** the extension does not call `openspec-ops finish`
- **AND** the watch remains armed for a later settle evaluation

---

### Requirement: Finish only when orphan hard conditions hold
At settle evaluation for a watched change, the extension SHALL run `openspec-ops where <change> --json` and apply these rules:

**Orphan hard conditions** (all required before any automatic finish path):

1. where succeeds (worktree exists)
2. worktree is not dirty
3. change is not active — v1: `changeDirExists === false`

Behavior:

- If where reports not found: MUST NOT call finish; MUST clear the watch
- If worktree exists and change is still active: MUST NOT call finish; MUST keep the watch
- If worktree exists, change not active, and dirty: MUST NOT call finish; MUST NOT pass `--force`; MUST notify that automatic cleanup was skipped; MUST clear the watch after notify (v1 anti-nag)
- If orphan hard conditions hold and policy is `ask`: MUST confirm; finish only if accepted; if no UI is available, MUST NOT silent-finish
- If orphan hard conditions hold and policy is `on`: MUST finish without confirm
- Finish invocations MUST use `--json` and MUST NOT pass `--force`

#### Scenario: Missing worktree clears watch quietly
- **WHEN** settle evaluation runs for watched change `add-dark-mode`
- **AND** `where` reports not found
- **THEN** the extension does not call `openspec-ops finish`
- **AND** the watch for that change is cleared

#### Scenario: Dirty inactive worktree skips automatic finish
- **WHEN** settle evaluation finds the worktree
- **AND** the change is not active
- **AND** the worktree is dirty
- **THEN** the extension does not call `openspec-ops finish`
- **AND** the user is notified that automatic cleanup was skipped

#### Scenario: Clean orphan under ask requires confirmation
- **WHEN** orphan hard conditions hold
- **AND** policy is `ask`
- **AND** the user declines confirmation
- **THEN** the extension does not call `openspec-ops finish`

#### Scenario: Clean orphan under ask with accept runs finish
- **WHEN** orphan hard conditions hold
- **AND** policy is `ask`
- **AND** the user accepts confirmation
- **THEN** the extension runs `openspec-ops finish <change> --json` without `--force`

#### Scenario: Ask without UI does not silent-finish
- **WHEN** orphan hard conditions hold
- **AND** policy is `ask`
- **AND** no UI confirm capability is available
- **THEN** the extension does not call `openspec-ops finish`

---

### Requirement: Archive path is fail-open
Hard errors during watch arm or settle finish evaluation (including missing `openspec-ops` binary, `where`/`finish` environment failures, or conflicts) MUST NOT cancel or fail the OpenSpec archive path.

The extension SHOULD notify the user of finish-gate failures when practical, including stable `error.code` when available.

#### Scenario: Missing binary does not block archive
- **WHEN** the user submits archive-intent with a parseable change name
- **AND** the openspec-ops binary cannot be resolved at input arm time or at settle time
- **THEN** archive input is still allowed to proceed (or has already proceeded)
- **AND** the extension does not treat missing binary as a reason to handle/cancel the archive input

#### Scenario: Finish CLI failure is non-fatal to session archive outcome
- **WHEN** settle evaluation proceeds to `openspec-ops finish`
- **AND** finish exits non-zero
- **THEN** the extension reports the failure
- **AND** does not claim OpenSpec archive failed because of finish

---

### Requirement: Manual ops-finish remains the fallback interface
The system MUST keep `openspec-ops finish` and the existing ops-finish skill/prompt usable as manual entry points independent of the auto-finish gate.

Auto-finish MUST NOT remove or break manual finish usage.

#### Scenario: Manual finish still works with policy off
- **WHEN** `OPENSPEC_OPS_AUTO_FINISH=off`
- **AND** a user runs manual finish via CLI or ops-finish skill
- **THEN** finish remains functional

---

### Requirement: Documentation of gate, orphan semantics, and disable switch
The root README SHALL document:

- That the Pi extension may reclaim a worktree after a watched change becomes inactive (typically after archive), not merely because `/opsx-archive` was typed
- Default policy `ask`, presence of `on` and `off`, and `OPENSPEC_OPS_AUTO_FINISH`
- That cleanup uses `openspec-ops finish` (branch kept), not OpenSpec archive
- That `/ops-finish` remains the manual / non-Pi-hook fallback
- That OpenSpec archive semantics are unchanged
- That v1 watch arm requires a kebab change name on the archive slash form

#### Scenario: README mentions auto finish policy and orphan semantics
- **WHEN** reading the root README after this change
- **THEN** it describes post-inactive/orphan finish-gate behavior, default `ask`, `on`/`off`, and the env override
