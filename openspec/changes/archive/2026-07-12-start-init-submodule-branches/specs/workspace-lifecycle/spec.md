## ADDED Requirements

### Requirement: Start accepts init-submodule-branches flag
The `openspec-ops start` command SHALL accept an optional boolean flag `--init-submodule-branches` that enables opt-in named branch creation/switch in detached top-level submodules under the change worktree.

#### Scenario: help mentions the flag
- **WHEN** a user runs `openspec-ops --help` or start help text is shown
- **THEN** usage documents `--init-submodule-branches` (or equivalent wording)
