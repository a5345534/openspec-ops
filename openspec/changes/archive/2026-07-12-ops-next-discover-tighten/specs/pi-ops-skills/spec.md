## ADDED Requirements

### Requirement: ops-next skill documents tightened discovery
The ops-next skill SHALL document that nameless candidate discovery uses active change directories and `.worktrees/<change>` paths, and does not treat the package/repo folder name as a change.

#### Scenario: skill mentions discovery sources
- **WHEN** reading the ops-next skill after this change
- **THEN** it describes worktree and active-change discovery without implying the package basename is a change
