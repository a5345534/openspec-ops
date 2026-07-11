## ADDED Requirements

### Requirement: Propose orchestration binds OpenSpec writes to workspace path
Package-shipped propose-related skills and prompts SHALL, once a change name is known, resolve `openspec-ops where`/`start` and use `result.path` as cwd for OpenSpec CLI and `openspec/changes/<change>/` writes, following worktree-write-alignment fail-closed rules.

Ops-specific steps SHALL be enclosed in:

`<!-- openspec-ops:worktree-alignment BEGIN -->` … `<!-- openspec-ops:worktree-alignment END -->`

so operators can detect loss after `openspec update`.

#### Scenario: propose skill mentions where then cwd
- **WHEN** reading the package propose skill or matching prompt
- **THEN** it includes steps to resolve the workspace path and perform scaffold/writes there

#### Scenario: propose skill has durable marker block
- **WHEN** reading the package propose skill after this change
- **THEN** the worktree-alignment BEGIN/END markers are present

### Requirement: Apply orchestration prefers workspace path when known
Package-shipped apply-related skills and prompts SHOULD instruct the agent to prefer the openspec-ops worktree path as cwd when implementing a named change that has a registered workspace.

#### Scenario: apply skill mentions worktree path when available
- **WHEN** reading the package apply skill
- **THEN** it mentions using the change worktree path from openspec-ops when known
