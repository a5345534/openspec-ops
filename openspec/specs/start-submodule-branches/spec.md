# start-submodule-branches Specification

## Purpose

Opt-in named branch creation for detached top-level submodules at start.

## Requirements

### Requirement: Start may init named branches in detached top-level submodules
When `openspec-ops start` is invoked with `--init-submodule-branches`, after the change worktree is ready (created or reused), the system SHALL attempt to place each **checked-out top-level** submodule that is on detached HEAD onto a local branch named like the change branch (default equal to the change name).

For each such submodule:

- If the branch already exists locally, the system SHALL switch to it
- Otherwise the system SHALL create it at the current HEAD (`git switch -c`)
- The system MUST NOT auto-commit, auto-push, or update the parent gitlink solely due to this flag

#### Scenario: detached submodule gets a branch
- **WHEN** start runs with `--init-submodule-branches`
- **AND** a top-level submodule is checked out detached
- **AND** no local branch with the change branch name exists in that submodule
- **THEN** a branch with that name is created at the current HEAD
- **AND** HEAD is attached to that branch

#### Scenario: existing submodule branch is switched
- **WHEN** start runs with `--init-submodule-branches`
- **AND** a detached submodule already has a local branch matching the change branch name
- **THEN** the system switches to that branch without recreating it as a forced reset of content beyond switch semantics

#### Scenario: default start does not init branches
- **WHEN** start runs without `--init-submodule-branches`
- **THEN** the system does not create or switch submodule branches solely for this feature

### Requirement: Submodule branch init is fail-open per submodule
If init fails for one submodule, start MUST still succeed for the parent worktree when parent start otherwise succeeded, and MUST record a warning (or equivalent) for the failed submodule.

#### Scenario: one submodule fails others continue
- **WHEN** init fails for submodule A and would succeed for B
- **AND** parent worktree start succeeded
- **THEN** the overall start command still succeeds
- **AND** the result includes warning or failed action detail for A

### Requirement: Start result reports submodule branch actions
When the flag is used, the start success result SHALL include a structured list of submodule branch actions (path, branch, action) suitable for JSON consumers, empty when nothing was done.

#### Scenario: JSON includes submoduleBranches
- **WHEN** start succeeds with `--init-submodule-branches` and at least one submodule was processed
- **THEN** the JSON result includes a `submoduleBranches` (or equivalent) array describing actions taken
