## MODIFIED Requirements

### Requirement: Finish removes worktree and cleans merged branches
`openspec-ops finish` SHALL remove the change worktree when one is registered (subject to existing dirty/`--force` and submodule teardown rules). After worktree handling, unless `--keep-branch` is set, finish SHALL attempt parent local and remote branch cleanup for a **bounded candidate set** of heads:

1. the **change-default** branch from `defaultBranch(change, --branch)` (normally equal to the change name when `--branch` is omitted)
2. the **resolved located** branch (worktree current branch when a worktree is present; otherwise the same as change-default)

When those two resolve to the same name, finish SHALL clean that head once. When they differ, finish SHALL attempt cleanup for **each** distinct head independently.

For each candidate head, finish SHALL delete the local and remote branches only when a merged PR for **that** head branch is verified via the PR backend (gh), using non-force local delete (`git branch -d`) and remote delete without force-push semantics. A merged PR for one head MUST NOT authorize deletion of a different unmerged head.

If no merged PR is found for a given head, finish MUST retain that head and MUST NOT force-delete it because of `--force`.

#### Scenario: merged finish removes worktree and branches
- **WHEN** a clean worktree exists for the change
- **AND** the worktree branch equals the change-default branch
- **AND** a merged PR exists for that branch
- **AND** finish is run without `--keep-branch`
- **THEN** the worktree is removed
- **AND** local and remote branches for that head are deleted when present
- **AND** the result indicates branch cleanup occurred

#### Scenario: located branch differs from change-default after archive switch
- **WHEN** a clean worktree exists for the change
- **AND** the worktree is on a branch different from the change-default name (e.g. `archive-<change>`)
- **AND** a merged PR exists for the change-default head
- **AND** a merged PR exists for the located head (or that head is already absent)
- **AND** finish is run without `--keep-branch`
- **THEN** the worktree is removed
- **AND** finish attempts cleanup for both the change-default head and the located head
- **AND** each head with a verified merged PR has local and remote branches deleted when present

#### Scenario: unmerged secondary head is kept while merged change-default is pruned
- **WHEN** the located branch differs from the change-default branch
- **AND** a merged PR exists only for the change-default head
- **AND** no merged PR exists for the located head
- **AND** finish is run without `--keep-branch`
- **THEN** the change-default local/remote branches are deleted when present
- **AND** the located branch is retained
- **AND** finish does not force-delete the unmerged located head

#### Scenario: unmerged finish keeps branch
- **WHEN** finish removes a worktree
- **AND** no merged PR exists for any candidate head
- **THEN** local candidate branches are retained
- **AND** `--force` does not cause unmerged branch deletion

#### Scenario: keep-branch retains branches even if merged
- **WHEN** finish is run with `--keep-branch`
- **AND** a merged PR exists for one or more candidate heads
- **THEN** branches are not deleted by that invocation

## ADDED Requirements

### Requirement: Finish reports multi-head parent branch cleanup outcomes
When finish performs parent branch cleanup (or skips it due to `--keep-branch`), the success result SHALL expose enough structure for agents to see **per-candidate-head** outcomes without implying submodule refs were deleted.

The result SHALL retain a compatibility aggregate `branchCleanup` summary and SHALL include a per-head detail list (e.g. `branchCleanup.heads` or equivalent) with at least: branch name, attempted, local/remote deleted or already absent, keptReason, and merged PR identity when used.

Non-JSON finish output SHALL mention each candidate head’s cleanup outcome briefly when more than one head was considered or when outcomes differ.

`result.branch` SHALL continue to identify the resolved located/display branch (worktree branch when present). `branchDeleted` SHALL be true when any candidate local branch was deleted this run.

Parent multi-head cleanup MUST NOT expand default submodule branch probing or prune submodule branches.

#### Scenario: JSON lists both heads when they differ
- **WHEN** finish cleans (or attempts) both change-default and located heads that differ by name
- **AND** JSON output is requested
- **THEN** the result includes per-head detail for each candidate
- **AND** the aggregate summary does not claim submodule cleanup

#### Scenario: single head remains one cleanup record
- **WHEN** change-default and located resolve to the same branch name
- **THEN** finish performs at most one cleanup attempt for that name
- **AND** per-head detail contains a single entry for that branch

#### Scenario: human output distinguishes heads
- **WHEN** non-JSON finish considers more than one parent head
- **THEN** output identifies cleanup outcomes per head name
- **AND** does not describe residual submodule refs as parent multi-head cleanup
