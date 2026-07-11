## ADDED Requirements

### Requirement: Dirty skip message guides next steps without shipping
When automatic finish is skipped because the worktree is dirty, the user-visible message SHALL indicate that cleanup was skipped due to dirtiness and SHALL mention either committing/shipping the branch or explicitly consenting to force-finish—without performing commit or merge automatically.

#### Scenario: dirty skip mentions force consent or commit
- **WHEN** auto-finish skips a dirty worktree
- **THEN** the message references dirty state and does not imply a commit or merge was performed

### Requirement: Finish automation never merges to main
Automatic or CLI finish as used by this gate MUST NOT merge the change branch into main.

#### Scenario: finish keeps branch by default
- **WHEN** finish succeeds via the automated gate or CLI default
- **THEN** the branch is retained unless a separate explicit product feature deletes it
