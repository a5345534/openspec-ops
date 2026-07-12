## ADDED Requirements

### Requirement: Finish teardown accounts for submodules before worktree remove
The finish command’s worktree removal path SHALL attempt to unload initialized top-level submodules in the target worktree before invoking `git worktree remove`, so that git’s “worktree contains submodules” refusal does not leave finish permanently stuck on typical monorepo layouts.

#### Scenario: finish does not rely on manual deinit for happy path
- **WHEN** a clean change worktree contains an initialized top-level submodule
- **AND** finish is run without prior manual submodule deinit
- **THEN** finish still completes worktree removal on the happy path
