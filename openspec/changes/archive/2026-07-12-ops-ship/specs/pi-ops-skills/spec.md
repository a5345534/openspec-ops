## ADDED Requirements

### Requirement: ops-ship skill and prompt exist
The project SHALL provide a Pi skill and matching slash prompt for shipping a change worktree (`ops-ship`), under the ops-* package export surface only.

The skill/prompt SHALL instruct the agent to:
- Resolve `openspec-ops` binary
- Run `openspec-ops ship <change> ... --json`
- Handle JSON/exit codes
- Not merge the PR
- Not use finish as a substitute for ship
- Prefer explicit user consent before ship when changes are large or unexpected

#### Scenario: ops-ship skill documents ship command
- **WHEN** reading the ops-ship skill
- **THEN** it includes an `openspec-ops ship` invocation with `--json`
