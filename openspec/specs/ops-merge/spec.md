# ops-merge Specification

## Purpose

Explicit PR merge for a named change via gh: checks hard gate, default squash, invoke-is-consent; no post-merge chain.

## Requirements

### Requirement: merge command merges the change PR via gh with default squash
The system SHALL provide `openspec-ops merge <change>` that merges the open pull request for the change’s branch using GitHub CLI, with default merge method **squash**, and optional method override.

Invoking the merge command constitutes operator authorization; the command MUST NOT require an additional confirmation flag for consent in v1.

#### Scenario: successful squash merge
- **WHEN** an open PR exists for the change branch
- **AND** required checks are all successful
- **AND** the user runs `openspec-ops merge <change> --json`
- **THEN** the PR is merged with squash (unless another method was requested)
- **AND** the result reports merged success metadata

#### Scenario: invoke is consent
- **WHEN** merge is invoked with valid preconditions
- **THEN** the implementation does not require a separate `--yes` consent flag to proceed

---

### Requirement: Checks hard gate before merge
Before merging, the system SHALL verify PR checks status via gh.

If one or more checks are reported and any are not successful (failed, pending, or other non-success aggregate state as reported by gh), merge MUST abort and MUST NOT merge the PR.

If **zero** checks are reported for the PR (no CI configured / "no checks reported"), merge MUST allow by default. Operators MAY set `OPENSPEC_OPS_MERGE_EMPTY_CHECKS=refuse` (or `strict` / `fail` / `off`) to fail closed on empty checks.

If checks status cannot be determined for a reason other than empty checks (gh missing, unexpected query failure, non-empty indeterminate error), merge MUST fail closed and MUST NOT merge.

#### Scenario: failing or pending checks block merge
- **WHEN** PR checks are not all successful according to gh (and at least one check is reported)
- **AND** the user runs merge
- **THEN** the command fails with a stable `checks_failed` (or equivalent) error
- **AND** the PR is not merged

#### Scenario: empty checks allow merge by default
- **WHEN** gh reports no status checks for the PR
- **AND** `OPENSPEC_OPS_MERGE_EMPTY_CHECKS` is unset or `allow`
- **AND** the user runs merge
- **THEN** the empty-checks state does not by itself block merge
- **AND** merge may proceed (subject to other gates)

#### Scenario: empty checks refuse when configured
- **WHEN** gh reports no status checks for the PR
- **AND** `OPENSPEC_OPS_MERGE_EMPTY_CHECKS` is `refuse` (or `strict` / `fail` / `off`)
- **AND** the user runs merge
- **THEN** the command fails with `checks_failed`
- **AND** the PR is not merged

#### Scenario: cannot evaluate checks blocks merge
- **WHEN** gh cannot provide a successful checks evaluation for a reason other than empty checks
- **AND** the user runs merge
- **THEN** the command fails without merging

---

### Requirement: No post-merge chain
Merge MUST NOT run archive, finish, or prune as part of its success path, and MUST NOT delete the head branch by default.

#### Scenario: merge does not prune or archive
- **WHEN** merge succeeds
- **THEN** the command does not remove the worktree, archive the OpenSpec change, or delete branches as a required side effect

---

### Requirement: No auto-merge policy in this capability
This capability MUST NOT define a default-on automatic merge after ship or impl-review.

#### Scenario: ship success does not imply merge
- **WHEN** ship completes successfully
- **THEN** merge is not required to run unless the operator invokes merge (or an explicit future policy not in this capability’s default-on scope)

---

### Requirement: Already merged is non-destructive
When the change branch’s PR is already merged, merge SHALL report an already-merged success (or equivalent non-error outcome) without attempting a conflicting merge.

#### Scenario: already merged reports cleanly
- **WHEN** no open PR exists but the PR was already merged for that head
- **THEN** the command exits successfully with an already-merged style result
- **AND** does not require a worktree to exist

### Requirement: Worktree not required for merge
Merge MUST operate using repository + gh PR identity for the change branch and MUST NOT require an openspec-ops worktree to still be registered.

#### Scenario: merge without worktree
- **WHEN** `where <change>` would be not_found
- **AND** an open PR for the change branch has green checks
- **THEN** merge may still succeed

