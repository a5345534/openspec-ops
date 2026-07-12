## ADDED Requirements

### Requirement: ship is a workspace lifecycle command
The openspec-ops CLI SHALL expose `ship` as a first-class command alongside start/where/finish/doctor, accepting a change name and operating on the resolved change worktree.

#### Scenario: ship appears in CLI help
- **WHEN** a user runs `openspec-ops --help`
- **THEN** usage text includes a `ship` command summary

### Requirement: ship reuses worktree resolution
Ship MUST resolve the target worktree using the same change name → path/branch rules as `where`/`start` (defaults: branch=`<change>`, path=`<primary>/.worktrees/<change>`).

#### Scenario: ship not_found when no worktree
- **WHEN** no worktree exists for the change
- **AND** the user runs `openspec-ops ship <change> --json`
- **THEN** the command fails with not_found (or equivalent) and does not create a worktree implicitly unless design explicitly adds ensure (v1: do not implicit start)
