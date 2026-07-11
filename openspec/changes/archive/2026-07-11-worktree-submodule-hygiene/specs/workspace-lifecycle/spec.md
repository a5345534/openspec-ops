## ADDED Requirements

### Requirement: Where result includes top-level submodule summary
On successful `where`, the result object SHALL include a `submodules` field: an array of objects with at least `path`, `detached`, and `dirty` for top-level submodules under the worktree (`[]` when none).

schemaVersion remains 1. Field is additive for readers that ignore unknown keys.

#### Scenario: additive field does not change not_found
- **WHEN** where cannot find a worktree
- **THEN** behavior remains not_found as today
- **AND** no submodule probe is required

### Requirement: Finish dirty error mentions submodules
When finish fails with `worktree_dirty`, the message SHALL mention that uncommitted submodule work can contribute to dirtiness and that force removes the worktree without preserving uncommitted changes.

#### Scenario: worktree_dirty still exit 4
- **WHEN** finish is invoked on a dirty worktree without `--force`
- **THEN** the command still fails with the dirty worktree error class
- **AND** does not auto-clean or auto-commit
