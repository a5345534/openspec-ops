## ADDED Requirements

### Requirement: Post-ensure hard write-path constraint
After successful workspace ensure for a parseable change name, the extension SHALL provide an agent-visible constraint that all OpenSpec change artifact writes and preferred implementation writes for that change use the ensured worktree path.

The extension MUST NOT imply that the process cwd has been switched unless such a switch was actually performed.

#### Scenario: handoff names absolute worktree path
- **WHEN** ensure succeeds with path `W` for change `add-dark-mode`
- **THEN** the handoff message includes `W` and states that writes for the change must use that path

## MODIFIED Requirements

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
