## ADDED Requirements

### Requirement: Finish closeout documents submodule worktrees
Project documentation for finish/closeout SHALL note that change worktrees may contain submodules and that finish performs submodule-aware teardown (deinit as needed) before worktree removal, while dirty trees still require commit/stash or explicit `--force`.

#### Scenario: README or finish help mentions submodule teardown
- **WHEN** reading finish or submodule closeout documentation after this change
- **THEN** it mentions submodule-aware finish or deinit-before-remove behavior
