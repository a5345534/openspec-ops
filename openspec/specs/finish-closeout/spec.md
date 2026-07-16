# finish-closeout Specification

## Purpose

Finish closeout: remove change worktree and, when a merged PR is verified, delete local and remote change branches unless `--keep-branch`.
## Requirements
### Requirement: Finish removes worktree and cleans merged branches
`openspec-ops finish` SHALL remove the change worktree when one is registered (subject to existing dirty/`--force` and submodule teardown rules). After worktree handling, unless `--keep-branch` is set, finish SHALL delete the local and remote change branches when a merged PR for that head branch is verified via the PR backend (gh), using non-force local delete (`git branch -d`) and remote delete without force-push semantics.

If no merged PR is found, finish MUST retain the branch and MUST NOT force-delete it because of `--force`.

#### Scenario: merged finish removes worktree and branches
- **WHEN** a clean worktree exists for the change
- **AND** a merged PR exists for the change branch
- **AND** finish is run without `--keep-branch`
- **THEN** the worktree is removed
- **AND** local and remote branches are deleted when present
- **AND** the result indicates branch cleanup occurred

#### Scenario: unmerged finish keeps branch
- **WHEN** finish removes a worktree
- **AND** no merged PR exists for the branch
- **THEN** the local branch is retained
- **AND** `--force` does not cause unmerged branch deletion

#### Scenario: keep-branch retains branches even if merged
- **WHEN** finish is run with `--keep-branch`
- **AND** a merged PR exists
- **THEN** branches are not deleted by that invocation

---

### Requirement: Finish without worktree can clean merged branches
When no worktree is registered for the change, finish SHALL still accept the change name and, unless `--keep-branch`, perform merged-PR branch cleanup (local + remote) without requiring a worktree.

#### Scenario: branch-only finish after worktree already gone
- **WHEN** where would report not_found for the worktree
- **AND** a merged PR exists for the change branch
- **AND** finish is run without `--keep-branch`
- **THEN** finish attempts local/remote branch deletion
- **AND** does not fail solely due to missing worktree

---

### Requirement: Finish does not merge or archive
Finish MUST NOT merge pull requests and MUST NOT archive OpenSpec changes.

#### Scenario: finish is not merge
- **WHEN** finish succeeds
- **THEN** it does not merge a PR as part of that command

### Requirement: Finish documents success boundary versus primary update
Project documentation for finish and deliver/closeout SHALL state that a successful finish (and a successful merge on the remote) does **not** by itself update the operator’s primary worktree to match `origin/<base>`, and SHALL point operators at a recommended monorepo checklist: checkout base on primary, `git pull --ff-only`, then `git submodule update --init` (recursive as needed), expecting submodules detached at gitlink unless an attach policy is used.

#### Scenario: README or finish help states primary not auto-pulled
- **WHEN** reading finish or deliver closeout documentation after this change
- **THEN** it states that GitHub/mainline success does not imply the primary checkout was pulled
- **AND** it documents recommended pull and submodule update steps for monorepos

---

### Requirement: Finish accepts opt-in primary closeout sync flags
`openspec-ops finish` SHALL accept documented opt-in flags for primary closeout sync (`--sync-primary`, `--sync-submodules`, and `--attach-submodule-main`, all default off) whose behavior is defined by the `primary-closeout-sync` capability. Without those flags, finish behavior for worktree removal and merged parent branch cleanup remains unchanged.

#### Scenario: flags default off
- **WHEN** finish is invoked without sync flags
- **THEN** no primary pull or primary submodule update is required for success
- **AND** worktree removal and merged-branch cleanup still apply as specified elsewhere

#### Scenario: help lists sync flags as optional
- **WHEN** a user inspects finish CLI help after this change
- **THEN** `--sync-primary`, `--sync-submodules`, and `--attach-submodule-main` (or documented equivalents) appear as optional flags

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

