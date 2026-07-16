## ADDED Requirements

### Requirement: Matching submodule branch probe is bounded and read-only
The system SHALL provide a fail-open probe for a supplied expected branch name across checked-out top-level submodules declared by the parent worktree. The probe SHALL inspect only local branch refs, configured remote names, corresponding local remote-tracking refs, and the current symbolic branch.

The probe MUST NOT recurse into nested submodules, fetch, contact a remote service, switch branches, delete refs, commit, push, or update parent gitlinks.

#### Scenario: local matching branch exists
- **WHEN** a checked-out top-level submodule contains `refs/heads/<expected>`
- **THEN** the probe emits `submodule_change_branch_local`
- **AND** identifies whether that branch is currently checked out

#### Scenario: matching remote-tracking ref exists
- **WHEN** a configured submodule remote has a local `refs/remotes/<remote>/<expected>` ref
- **THEN** the probe emits `submodule_change_branch_remote_tracking`
- **AND** identifies the remote name
- **AND** does not claim it queried the live remote

#### Scenario: multiple top-level submodules and remotes
- **WHEN** multiple checked-out top-level submodules or configured remotes contain matching refs
- **THEN** the probe emits a separate bounded entry for each observed ref

#### Scenario: no submodules or refs
- **WHEN** no checked-out top-level submodule has an observable matching ref
- **THEN** the probe returns an empty array

#### Scenario: individual probe failure
- **WHEN** one submodule or Git ref query fails
- **THEN** the probe continues fail-open for other submodules
- **AND** does not fail lifecycle closeout solely due to diagnostics

### Requirement: Submodule branch diagnostics use stable scoped codes
Submodule branch diagnostics SHALL use stable codes `submodule_change_branch_local` and `submodule_change_branch_remote_tracking`. Each entry SHALL include submodule path and branch; remote-tracking entries SHALL include the remote name. Diagnostic wording and documentation MUST distinguish these refs from the parent repository's branch cleanup.

#### Scenario: operator reads finish JSON
- **WHEN** finish returns matching submodule branch diagnostics
- **THEN** each entry can be attributed to a specific submodule path and repository ref class
- **AND** cannot be mistaken for evidence that parent branch cleanup failed
