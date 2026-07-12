## ADDED Requirements

### Requirement: Prune deletes local and remote branch only when PR is merged
The system SHALL provide `openspec-ops prune <change>` that targets a single change’s branch (default branch name = change name) and deletes both the local branch and the remote branch on the configured remote (default `origin`) only after verifying that a pull request with that head branch is in a **merged** state via a PR backend (v1: GitHub CLI `gh`).

Prune MUST NOT delete branches when no merged PR is found for that head.

#### Scenario: merged PR allows local and remote delete
- **WHEN** no worktree is registered for the change
- **AND** a merged PR exists for head branch `<change>`
- **AND** local and remote branches exist
- **AND** the user runs `openspec-ops prune <change> --json`
- **THEN** the local branch is deleted
- **AND** the remote branch is deleted
- **AND** the result reports success with merged PR metadata

#### Scenario: not merged refuses delete
- **WHEN** no merged PR exists for the head branch
- **AND** the user runs prune
- **THEN** prune fails with a stable not-merged error
- **AND** neither local nor remote branch is deleted by that invocation

---

### Requirement: Prune refuses while worktree exists
Prune MUST refuse to delete branches when a registered git worktree still exists for the change (by default path or branch match used by lifecycle resolution).

#### Scenario: worktree present blocks prune
- **WHEN** `openspec-ops where <change>` would succeed (worktree exists)
- **AND** the user runs prune
- **THEN** prune fails indicating the worktree must be finished first
- **AND** branches are not deleted

---

### Requirement: No force delete of unmerged branches
Prune MUST NOT provide a v1 flag that deletes branches without merged-PR verification, and MUST NOT use force-delete (`git branch -D`) as the automated happy path—even when a PR is merged but `git branch -d` refuses (e.g. after squash).

#### Scenario: no unmerged force path required
- **WHEN** implementing prune v1
- **THEN** success criteria do not include deleting a branch that has only an open or missing PR

#### Scenario: merged PR but local -d fails surfaces error
- **WHEN** a merged PR is verified
- **AND** local branch still exists
- **AND** `git branch -d` fails
- **THEN** prune fails without having force-deleted the local branch via `-D`

---

### Requirement: Single change only
Prune SHALL require a change name argument and MUST NOT implement bulk deletion of all merged branches in v1.

#### Scenario: change name required
- **WHEN** prune is invoked without a change name
- **THEN** the command fails with a usage error

---

### Requirement: Idempotent already-absent branches
If a merged PR is verified and a local or remote branch is already absent, prune SHALL treat that side as already clean and continue with the other side rather than failing solely due to absence (including when GitHub already auto-deleted the remote head).

#### Scenario: local already deleted still attempts remote
- **WHEN** merged PR is verified
- **AND** local branch is already absent
- **AND** remote branch still exists
- **THEN** prune attempts remote deletion
- **AND** reports local already absent in the result when successful overall

#### Scenario: remote already absent still succeeds after local delete
- **WHEN** merged PR is verified
- **AND** remote branch is already absent
- **AND** local branch is deleted or already absent
- **THEN** prune may succeed with remote alreadyAbsent

---

### Requirement: JSON envelope for prune
Prune with `--json` SHALL return schemaVersion 1 envelopes including change, branch, remote, merged PR identity when used, and local/remote deletion outcomes.

#### Scenario: json success includes deletion flags
- **WHEN** prune succeeds
- **THEN** `result` includes local and remote deletion outcome fields

---

### Requirement: Prune is not finish, ship, merge, or archive
Prune MUST NOT remove worktrees, MUST NOT create commits or PRs, MUST NOT merge PRs, and MUST NOT archive OpenSpec changes.

#### Scenario: prune does not remove worktree as cleanup path
- **WHEN** a worktree exists
- **THEN** prune does not delete the worktree; it fails until finish has been used
