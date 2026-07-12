## MODIFIED Requirements

### Requirement: Finish removes worktree and retains branch unless merged cleanup applies
`openspec-ops finish <change>` SHALL remove the change's registered worktree when one exists (subject to dirty/`--force` and submodule teardown rules).

Finish MUST NOT run OpenSpec archive, MUST NOT merge, and MUST NOT push except as required to delete a remote branch during merged-branch cleanup.

Finish MUST retain the local branch when no merged PR is verified for the change head, and when `--keep-branch` is set. Finish MAY delete local and remote change branches when a merged PR is verified and `--keep-branch` is not set.

#### Scenario: Clean finish with unmerged branch keeps branch
- **WHEN** the worktree exists and is clean
- **AND** no merged PR exists for the change branch
- **AND** the user runs `openspec-ops finish <change> --json`
- **THEN** the worktree is removed
- **AND** the local branch is retained

#### Scenario: Clean finish with merged PR may delete branch
- **WHEN** the worktree exists and is clean
- **AND** a merged PR exists for the change branch
- **AND** finish is run without `--keep-branch`
- **THEN** the worktree is removed
- **AND** local and remote branches may be deleted when present

#### Scenario: Dirty finish refused
- **WHEN** the worktree is dirty
- **AND** the user runs finish without `--force`
- **THEN** the command fails without removing the worktree

#### Scenario: Forced dirty finish
- **WHEN** the worktree is dirty
- **AND** the user runs finish with `--force`
- **THEN** the worktree may be removed
- **AND** unmerged branches are still not force-deleted solely due to `--force`

---

## ADDED Requirements

### Requirement: Finish may delete branches when PR is merged
`openspec-ops finish` MAY delete the change branch after worktree removal when a merged PR is verified. Operators MAY pass `--keep-branch` to skip all branch deletion.

#### Scenario: result reports whether branch was deleted
- **WHEN** finish completes
- **THEN** the result includes whether the local branch was deleted or kept (e.g. `branchDeleted` and/or structured branch fields)

### Requirement: Finish accepts missing worktree for branch cleanup
Finish MUST NOT require a registered worktree when the only remaining closeout work is merged-branch deletion.

#### Scenario: not_found worktree does not hard-fail finish if branch cleanup applies
- **WHEN** no worktree exists
- **AND** finish is invoked for a change with a merged PR and existing local or remote branch
- **THEN** finish does not fail with not_found solely due to missing worktree
