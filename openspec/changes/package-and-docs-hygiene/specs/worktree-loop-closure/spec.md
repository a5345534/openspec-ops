## MODIFIED Requirements

### Requirement: Post-archive finish never commits and never force-cleans dirty trees automatically
After archive, reclaiming a worktree via finish SHALL remain non-committing and MUST NOT auto-pass `--force` for dirty trees. Finish is invoked explicitly by the operator (or via guided next-step choice), not by retired auto-finish policy.

Dirty worktrees still require explicit `--force` consent; the system MUST NOT describe this as “auto-finish skipped” as if auto-finish were still the default path.

#### Scenario: dirty worktree requires explicit force for finish
- **WHEN** a change worktree is dirty after archive
- **AND** finish is run without `--force`
- **THEN** finish fails without removing the worktree
- **AND** messaging does not depend on auto-finish policy env

#### Scenario: finish is not auto-chained from archive
- **WHEN** archive completes
- **THEN** finish is not required to run automatically
- **AND** operators use `/ops-finish` or `/ops-next` to reclaim the worktree
