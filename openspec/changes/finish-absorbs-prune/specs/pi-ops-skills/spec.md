## ADDED Requirements

### Requirement: ops-finish documents merged branch cleanup
The ops-finish skill/prompt SHALL describe that finish removes the worktree when present and, when the PR is merged, deletes local and remote branches unless `--keep-branch` is used.

#### Scenario: ops-finish mentions branch cleanup
- **WHEN** reading ops-finish after this change
- **THEN** it mentions merged PR branch deletion or keep-branch

### Requirement: ops-prune redirects to finish
The ops-prune skill/prompt SHALL state that finish is the preferred closeout command and that prune is deprecated or branch-only compatibility.

#### Scenario: ops-prune points at finish
- **WHEN** reading ops-prune after this change
- **THEN** it recommends finish for normal closeout
