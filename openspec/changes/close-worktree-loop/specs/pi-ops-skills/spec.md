## ADDED Requirements

### Requirement: Apply skill prefers openspec-ops worktree path
Package-shipped apply-related skills and prompts (ops-* surface only) SHALL instruct the agent, once a change name is known, to resolve `openspec-ops where`/`start` when available and prefer `result.path` as cwd for implementation writes for that change.

#### Scenario: apply skill mentions where path
- **WHEN** reading the package apply skill or matching ops-aligned apply prompt section
- **THEN** it mentions using the openspec-ops worktree path when known

Note: Package export remains ops-* only; this does not reintroduce `openspec-*` / `opsx-*` package skills.
