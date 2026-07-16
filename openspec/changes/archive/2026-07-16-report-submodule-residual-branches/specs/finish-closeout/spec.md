## ADDED Requirements

### Requirement: Finish reports residual submodule branch refs separately from parent cleanup
When finish locates a change worktree, it SHALL capture branch-ref diagnostics matching the resolved parent finish branch from checked-out top-level submodules before submodule teardown. The resolved branch SHALL honor an explicitly supplied `--branch`; otherwise it is the located/default change branch. Every successful finish result SHALL include a `submoduleBranchDiagnostics` array, including `[]` when no matching refs are observable or when closeout is branch-only.

Each entry SHALL identify the submodule path, matched branch, stable diagnostic code, optional remote, and whether the matching local branch is currently checked out. Non-JSON finish output SHALL summarize each observed residual with its submodule path and ref class. Parent `branchCleanup` fields MUST continue to describe only the parent repository and MUST NOT imply that submodule refs were deleted.

#### Scenario: parent cleanup succeeds with residual submodule refs
- **WHEN** finish removes a parent change worktree and cleans the merged parent branch
- **AND** a checked-out top-level submodule has a local or remote-tracking ref matching the change branch
- **THEN** finish succeeds normally
- **AND** `branchCleanup` reports parent cleanup only
- **AND** `submoduleBranchDiagnostics` reports the observed submodule refs

#### Scenario: explicit parent branch selects diagnostic branch
- **WHEN** finish resolves an explicit parent `--branch` that differs from the change name
- **THEN** submodule diagnostics match that resolved branch
- **AND** do not silently probe only the change name

#### Scenario: human output distinguishes submodule residuals
- **WHEN** non-JSON finish succeeds with matching submodule refs
- **THEN** output identifies them as submodule local or remote-tracking residuals
- **AND** does not describe them as failed parent cleanup

#### Scenario: no matching observable refs
- **WHEN** finish finds no matching local or remote-tracking submodule refs
- **THEN** the successful result contains `submoduleBranchDiagnostics: []`

#### Scenario: branch-only closeout
- **WHEN** no change worktree exists and finish performs only merged parent branch cleanup
- **THEN** the successful result contains `submoduleBranchDiagnostics: []`

### Requirement: Default finish never prunes submodule branches
Default finish SHALL treat submodule branch diagnostics as informational metadata only. It MUST NOT switch, delete, fetch, push, force-update, or infer merge safety for submodule branches as part of this capability.

#### Scenario: diagnostic reports a matching local branch
- **WHEN** finish reports `submodule_change_branch_local`
- **THEN** the local submodule branch remains unchanged

#### Scenario: diagnostic reports a remote-tracking branch
- **WHEN** finish reports `submodule_change_branch_remote_tracking`
- **THEN** finish does not claim the live remote branch exists or is merged
- **AND** does not delete any remote branch
