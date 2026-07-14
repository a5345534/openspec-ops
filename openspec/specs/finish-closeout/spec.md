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

