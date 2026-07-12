## ADDED Requirements

### Requirement: ops-prune skill and prompt exist
The project SHALL provide a Pi skill and matching prompt for `ops-prune` that instruct the agent to run `openspec-ops prune <change> --json`, only after merge and after worktree finish, and never to force-delete unmerged branches or bulk-delete unrelated branches.

#### Scenario: ops-prune skill documents prune command
- **WHEN** reading the ops-prune skill
- **THEN** it includes `openspec-ops prune` with `--json` and merged-PR gating guidance
