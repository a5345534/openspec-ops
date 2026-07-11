## ADDED Requirements

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
