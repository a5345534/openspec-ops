## ADDED Requirements

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
