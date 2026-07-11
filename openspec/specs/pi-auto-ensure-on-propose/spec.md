# pi-auto-ensure-on-propose Specification

## Purpose

Pi harness gate that ensures an openspec-ops workspace before OpenSpec propose, without modifying OpenSpec's propose workflow.

## Requirements

### Requirement: Harness gate without forking OpenSpec propose
The system SHALL provide a Pi extension that can run before OpenSpec propose prompt/skill expansion and MUST NOT replace or reimplement the OpenSpec propose workflow.

After a successful workspace ensure, the extension MUST release the original user input so the stock `/opsx-propose` (or equivalent) path expands and runs as it would without the extension (aside from workspace side effects already performed).

The extension MUST NOT require modifications to OpenSpec CLI commands or the semantic steps of propose artifact creation.

#### Scenario: Successful ensure then stock propose proceeds
- **WHEN** the user submits a propose-intent command with a parseable change name and policy is `on`
- **AND** workspace ensure succeeds
- **THEN** the original propose input is allowed to continue to OpenSpec propose expansion/handling
- **AND** the extension does not itself generate proposal/design/tasks artifacts

#### Scenario: Policy off leaves propose untouched
- **WHEN** policy is `off`
- **AND** the user submits `/opsx-propose <change>`
- **THEN** the extension performs no workspace ensure side effects for that input
- **AND** propose proceeds as without the gate

---

### Requirement: Detect propose intent with strong signals only
The extension SHALL treat input as propose-intent only for strong slash forms, including at least:

- `/opsx-propose` at the start of input (optional args after)
- `/opsx:propose` at the start of input if supported in the environment

The extension MUST NOT treat bare-word chat containing “propose” as propose-intent for auto-ensure in this capability.

Slash-based ensure remains an optional accelerator when a kebab name is present on the slash line. Primary ensure-before-scaffold for agent-named changes is defined by capability `openspec-cli-intercept` on `openspec new change`.

#### Scenario: opsx-propose is detected
- **WHEN** the user input begins with `/opsx-propose`
- **THEN** the extension classifies the input as propose-intent for policy evaluation

#### Scenario: explore is not detected as propose
- **WHEN** the user input begins with `/opsx-explore`
- **THEN** the extension does not run workspace ensure for that input as part of this capability

#### Scenario: slash without name does not ensure at input
- **WHEN** the user submits `/opsx-propose` with no parseable change name
- **AND** policy is `on`
- **THEN** the extension does not call `openspec-ops start` at input time for that submission

### Requirement: Parse change name conservatively
When propose-intent is detected, the extension SHALL attempt to parse a change name from the arguments.

If the first argument matches kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$`, the extension MUST use it as the change name.

If no valid change name can be parsed, the extension MUST NOT create a worktree and MUST allow propose to continue without ensure.

When no valid change name can be parsed, the extension SHOULD notify that worktree ensure is skipped until a change name is known (e.g. after `openspec new change`).

#### Scenario: Missing name skips ensure
- **WHEN** input is `/opsx-propose` with no change name argument
- **AND** policy is `on`
- **THEN** the extension does not call `openspec-ops start`
- **AND** propose input is still released/continued

#### Scenario: Missing name surfaces deferred ensure
- **WHEN** input is `/opsx-propose` with no parseable change name
- **AND** policy is `on`
- **THEN** the user or agent is informed that ensure/write alignment waits for a change name

### Requirement: Default policy on with off and ask options
The extension SHALL support policy values `on`, `ask`, and `off`.

The default policy MUST be `on` when no override is set.

Policy MUST be readable from environment variable `OPENSPEC_OPS_AUTO_START` with values `on`|`ask`|`off` (case-insensitive).

The `openspec-ops` CLI MUST NOT be required to implement this policy flag.

#### Scenario: Default is on
- **WHEN** `OPENSPEC_OPS_AUTO_START` is unset
- **THEN** the extension behaves as policy `on`

#### Scenario: Off disables gate side effects
- **WHEN** `OPENSPEC_OPS_AUTO_START=off`
- **THEN** propose-intent input does not trigger workspace ensure

---

### Requirement: Ensure uses openspec-ops only
Workspace ensure MUST be implemented solely by invoking the `openspec-ops` CLI with `--json` (schemaVersion 1), using the same binary resolution order as ops skills:

1. `OPENSPEC_OPS_BIN` if set  
2. `openspec-ops` on `PATH`  
3. Project-local `bin/openspec-ops` when resolvable  
4. Otherwise fail ensure with a clear error  

Ensure algorithm:

1. Run `where <change> --json`  
2. If found: success (reuse), bind path/branch for session hints  
3. If not found and policy `on`: run `start <change> --json`  
4. If not found and policy `ask`: confirm with user, then start only if accepted  
5. If not found and user declines ask: skip ensure and continue propose  
6. Never run raw `git worktree` / `git switch` as a fallback  

#### Scenario: Existing worktree is reused without start create
- **WHEN** `where` reports the change workspace exists
- **AND** policy is `on`
- **THEN** the extension does not need a creating start side effect beyond reuse semantics
- **AND** propose is allowed to continue

#### Scenario: Missing worktree is created under policy on
- **WHEN** `where` returns not_found
- **AND** policy is `on`
- **AND** `start` succeeds with action created or reused
- **THEN** propose is allowed to continue

#### Scenario: Binary missing fails closed for ensure
- **WHEN** policy is `on` and a change name is parsed
- **AND** the openspec-ops binary cannot be resolved
- **THEN** ensure fails
- **AND** propose does not proceed as a successful gated flow

---

### Requirement: Ensure failure aborts propose continuation
When policy requires ensure (or user accepted ask) and ensure fails with a hard error (including CLI exit codes for conflicts, environment errors, or git failures), the extension MUST NOT release input into a normal successful propose continuation.

The user MUST be shown a message including the stable `error.code` when available.

#### Scenario: branch_busy aborts propose
- **WHEN** `start` fails with `branch_busy` (or exit 3 conflict class)
- **THEN** the extension stops the gated propose continuation
- **AND** surfaces the error code to the user

---

### Requirement: Explicit ops-start remains available
The system MUST keep a way to manually ensure a workspace without going through propose (CLI and/or explicit ops-start skill/command), so advanced users can create a worktree without proposing.

Auto-ensure MUST NOT remove or break manual `openspec-ops start` usage.

#### Scenario: Manual start still works independently
- **WHEN** a user runs manual workspace start via CLI or explicit ops-start entrypoint
- **THEN** the command remains functional regardless of auto-ensure policy

---

### Requirement: Documentation of gate and disable switch
The root README SHALL document:

- That propose may auto-ensure a worktree by default (`on`)
- How to disable with `OPENSPEC_OPS_AUTO_START=off`
- That OpenSpec propose semantics are unchanged
- That execution uses `openspec-ops`, not raw git worktree

#### Scenario: README mentions auto ensure and off switch
- **WHEN** reading the root README after this change
- **THEN** it describes default-on ensure-before-propose and the `off` override

---

### Requirement: Post-ensure hard write-path constraint
After successful workspace ensure for a parseable change name, the extension SHALL provide an agent-visible constraint that all OpenSpec change artifact writes and preferred implementation writes for that change use the ensured worktree path.

The extension MUST NOT imply that the process cwd has been switched unless such a switch was actually performed.

#### Scenario: handoff names absolute worktree path
- **WHEN** ensure succeeds with path `W` for change `add-dark-mode`
- **THEN** the handoff message includes `W` and states that writes for the change must use that path
