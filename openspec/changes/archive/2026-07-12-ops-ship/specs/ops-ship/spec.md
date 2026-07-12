## ADDED Requirements

### Requirement: Ship commits entire change worktree then pushes and opens a PR
The system SHALL provide an `openspec-ops ship <change>` command that operates on the registered change worktree for `<change>` and, when there are local changes, stages **all** changes in that worktree (`git add -A` or equivalent), creates a single commit, pushes the change branch to the configured remote, and opens a pull request against a base branch via a PR backend.

Ship MUST NOT merge the pull request into the base branch.

#### Scenario: dirty worktree ships commit push and pr
- **WHEN** a change worktree exists and has uncommitted changes
- **AND** the user runs `openspec-ops ship <change> --json` with a successful PR backend
- **THEN** a commit is created including the worktree changes
- **AND** the branch is pushed
- **AND** a PR is created or reported
- **AND** no merge into base is performed

#### Scenario: clean worktree with unpushed commits still pushes and prs
- **WHEN** the worktree is clean
- **AND** the branch has commits not yet on the remote
- **THEN** ship skips creating a new commit
- **AND** still attempts push and PR as needed

#### Scenario: already synced with existing PR reports success
- **WHEN** the worktree is clean
- **AND** the branch is not ahead of the remote
- **AND** an open PR for the head branch already exists
- **THEN** ship succeeds without creating a new commit
- **AND** the result reports the existing PR

#### Scenario: nothing to ship
- **WHEN** the worktree is clean
- **AND** the branch is not ahead of the remote
- **AND** no PR can be created or found as needed
- **THEN** ship fails with a stable `nothing_to_ship` (or equivalent) error

#### Scenario: push succeeded but PR failed is retryable without new commit
- **WHEN** push completed successfully
- **AND** the PR backend fails
- **THEN** ship exits non-zero
- **AND** a subsequent ship after the worktree is clean does not require creating another commit solely to open the PR

---

### Requirement: Default commit message and overrides
Ship SHALL accept an explicit commit message flag. When omitted, ship SHALL use the default message **`ship(<change>): worktree`**.

#### Scenario: message flag used when provided
- **WHEN** ship is invoked with `--message "feat: foo"`
- **THEN** the created commit uses that message

#### Scenario: default message includes change name
- **WHEN** ship creates a commit without `--message`
- **THEN** the commit message is `ship(<change>): worktree` with the actual change name substituted

---

### Requirement: Pluggable PR backend with gh as v1 default
Ship SHALL invoke pull request creation through a PR backend abstraction with a **synchronous** adapter surface suitable for the CLI. The v1 default backend MUST be GitHub CLI (`gh`). The design MUST allow additional backends without changing the ship orchestration entrypoint.

When the selected backend is unavailable (e.g. `gh` not on PATH), ship MUST fail with a stable error code and installation/auth guidance. v1 MUST NOT silently skip the PR step after a successful push.

#### Scenario: missing gh fails clearly
- **WHEN** backend is `gh` and `gh` cannot be executed
- **THEN** ship fails with an error indicating PR backend unavailability

#### Scenario: successful gh pr returns url
- **WHEN** `gh pr create` (or equivalent) succeeds
- **THEN** the JSON result includes a PR URL and backend id `gh`

---

### Requirement: No force push by default
Ship MUST NOT pass `--force` to `git push` in the default happy path.

#### Scenario: default push is non-force
- **WHEN** ship pushes the change branch
- **THEN** the push invocation does not include `--force`

---

### Requirement: Submodule detached-dirty preflight aborts ship
Before committing the parent worktree, ship SHALL probe top-level submodules. If any top-level submodule is **detached and dirty**, ship MUST abort without creating the parent commit.

If a top-level submodule is detached but **clean**, ship MAY warn and MUST NOT require abort solely for that reason in v1.

#### Scenario: detached dirty submodule blocks ship
- **WHEN** probe reports a top-level submodule detached and dirty
- **AND** the user runs ship
- **THEN** ship exits unsuccessfully without creating a new parent commit for that run

#### Scenario: clean detached submodule does not require abort
- **WHEN** probe reports a top-level submodule detached and clean
- **AND** no submodule is detached and dirty
- **THEN** ship is not required to abort solely due to clean detached HEAD

---

### Requirement: Ship is not finish and not archive
Ship MUST NOT remove the worktree, MUST NOT archive OpenSpec changes, and MUST NOT delete the local branch.

#### Scenario: worktree remains after ship
- **WHEN** ship succeeds
- **THEN** the change worktree still exists
- **AND** OpenSpec change artifacts are not moved to archive by ship

---

### Requirement: JSON envelope for ship
Ship with `--json` SHALL return schemaVersion 1 success/error envelopes consistent with other openspec-ops commands, including change, path, branch, commit metadata when created, and PR metadata when created.

#### Scenario: json success includes pr fields
- **WHEN** ship succeeds with a new or existing PR
- **THEN** `result` includes PR url (and number when available) and branch identity
