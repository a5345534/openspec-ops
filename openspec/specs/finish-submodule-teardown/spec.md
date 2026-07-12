# finish-submodule-teardown Specification

## Purpose

Finish tears down change worktrees that contain initialized top-level submodules by deinit before worktree remove.

## Requirements

### Requirement: Finish removes worktrees that contain initialized top-level submodules
When `openspec-ops finish` runs against a registered change worktree that contains one or more **initialized top-level submodules**, the system SHALL prepare the worktree for removal (including deinitializing those submodules as needed) and then remove the worktree successfully, retaining the change branch.

#### Scenario: clean worktree with submodule finishes
- **WHEN** the change worktree is clean
- **AND** it contains an initialized top-level submodule
- **AND** the user runs `openspec-ops finish <change> --json`
- **THEN** the command exits successfully
- **AND** the worktree is no longer registered
- **AND** `branchDeleted` remains false

---

### Requirement: Dirty worktree still requires force
Finish MUST still refuse a dirty worktree without `--force`, including when dirtiness involves submodule content, consistent with existing dirty policy.

#### Scenario: dirty without force still blocked
- **WHEN** the worktree is dirty
- **AND** finish is invoked without `--force`
- **THEN** the command fails with worktree dirty semantics
- **AND** the worktree is not removed

---

### Requirement: Submodule teardown failure is actionable
If submodule preparation fails and the worktree cannot be removed because of submodules, finish MUST fail with stable error code **`submodule_teardown_failed`** (not only a bare unstructured `git_failed` when the cause is known to be submodule teardown), and MUST include a message or hint that guides deinit/removal remediation.

#### Scenario: teardown failure surfaces hint
- **WHEN** submodule deinit/preparation fails and remove cannot proceed
- **THEN** the error uses code `submodule_teardown_failed` when the failure is attributed to submodule teardown
- **AND** suggests remediation involving submodule deinit or manual worktree remove

