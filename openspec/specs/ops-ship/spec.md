# ops-ship Specification

## Purpose

Commit the entire change worktree, push the change branch, and open a pull request via a pluggable PR backend (v1: GitHub CLI `gh`). Does not merge, archive, or finish the worktree.
## Requirements
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

---

### Requirement: Ship remains non-merging while ops-merge exists
Even when a merge command exists in the product, `openspec-ops ship` MUST NOT merge the pull request as part of ship success.

#### Scenario: ship success does not merge
- **WHEN** ship completes successfully
- **THEN** the PR is not merged solely by the ship command

### Requirement: Ship preflights remote and GitHub readiness before commit mutation
Before staging or committing a dirty change worktree, ship SHALL resolve the requested remote's effective push URL (honoring an explicit Git push URL over the fetch URL), validate that push URL is compatible with the selected PR backend, and run that backend's read-only repository/authentication preflight. A known preflight failure MUST stop ship without creating a commit or attempting a push.

#### Scenario: requested remote is not configured
- **WHEN** the requested or default remote does not exist in Git configuration
- **THEN** ship fails with `remote_not_configured`
- **AND** error details identify the remote, `commitCreated: false`, `pushAttempted: false`, and `pushOk: false`
- **AND** no ship commit is created

#### Scenario: explicit push URL is selected
- **WHEN** the requested remote has distinct fetch and push URLs
- **THEN** ship preflights the URL Git will use for push
- **AND** does not validate only the fetch destination

#### Scenario: remote URL is not GitHub compatible for gh
- **WHEN** backend `gh` is selected
- **AND** the effective remote push URL cannot identify a supported GitHub `owner/repository`
- **THEN** ship fails with `remote_invalid` before commit or push

#### Scenario: GitHub authentication is unavailable
- **WHEN** the remote is GitHub-compatible
- **AND** authenticated `gh` access is unavailable
- **THEN** ship fails with `github_auth_failed` before commit or push
- **AND** provides authentication remediation

#### Scenario: GitHub repository does not exist
- **WHEN** an authenticated `gh` lookup cannot resolve the repository identified by the remote URL
- **THEN** ship fails with `github_repository_not_found` before commit or push
- **AND** reports the repository identity without creating it

#### Scenario: configured destination passes preflight
- **WHEN** the remote and selected backend repository/authentication checks pass
- **THEN** existing commit, push, and PR behavior proceeds unchanged

### Requirement: Ship failures report mutation facts and stable destination codes
Destination-related ship errors SHALL retain schema version 1 and include enough structured detail to determine whether a ship commit was created, whether a push was attempted, and whether that push succeeded. Push-time authentication failures, remote rejection, and other push failures MUST have distinct codes rather than generic `git_failed`.

#### Scenario: push authentication fails after commit
- **WHEN** preflight passes and ship creates a commit
- **AND** Git push fails due to authentication or authorization
- **THEN** ship fails with `push_auth_failed`
- **AND** error details report `commitCreated: true`, the commit SHA, `pushAttempted: true`, and `pushOk: false`

#### Scenario: remote rejects push
- **WHEN** preflight passes
- **AND** Git push is rejected by non-fast-forward, branch policy, or a remote hook
- **THEN** ship fails with `push_rejected`
- **AND** reports whether a commit was created

#### Scenario: other push failure
- **WHEN** preflight passes
- **AND** push fails for another reason such as network transport failure
- **THEN** ship fails with `push_failed`
- **AND** reports whether a commit was created and `pushOk: false`

#### Scenario: push succeeds but PR backend fails
- **WHEN** ship creates or reuses a commit and push succeeds
- **AND** pull-request creation then fails
- **THEN** error details preserve `commitCreated`, the commit SHA, `pushAttempted: true`, and `pushOk: true`

#### Scenario: rerun after remediation
- **WHEN** a prior ship created a commit but push failed
- **AND** the operator fixes the destination and reruns ship with a clean worktree
- **THEN** ship does not create a duplicate commit solely because of the retry

### Requirement: Ship does not bootstrap repositories implicitly
Ship MUST NOT create a GitHub repository, add or rewrite a remote, guess ownership, or choose repository visibility as part of remote preflight or failure recovery. Guidance for first push SHALL warn that all reachable branch history may be published and recommend explicit destination and history review.

#### Scenario: missing GitHub repository requires explicit remediation
- **WHEN** preflight reports `github_repository_not_found`
- **THEN** ship does not invoke GitHub repository creation
- **AND** guidance directs the operator to explicitly create/configure a destination and review publishable history
