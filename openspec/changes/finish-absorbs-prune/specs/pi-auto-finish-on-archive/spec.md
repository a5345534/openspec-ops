## ADDED Requirements

### Requirement: Auto-finish uses finish closeout semantics
When auto-finish runs `openspec-ops finish` for an orphan worktree, that finish invocation SHALL use the same finish closeout semantics as the CLI (including merged-branch cleanup when applicable), and still MUST NOT pass `--force` automatically.

#### Scenario: auto-finish does not force
- **WHEN** auto-finish invokes finish for a clean orphan
- **THEN** it does not pass `--force`
