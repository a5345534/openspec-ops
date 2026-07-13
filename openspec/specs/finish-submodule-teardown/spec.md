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

### Requirement: Prepare clears residual top-level submodule directories after deinit
When preparing a change worktree for removal, after deinitializing an initialized top-level submodule (or when a listed submodule path exists but is not initialized), the system SHALL remove residual directories for that path when they no longer look like an initialized submodule checkout, so that `git worktree remove` is not blocked solely by empty or hollow leftover directories.

The system MUST NOT delete a path that still looks initialized (has a submodule `.git` file or directory) when deinit did not succeed for that path.

#### Scenario: residual empty dir after deinit is cleared
- **WHEN** prepare runs on a worktree with an initialized top-level submodule
- **AND** deinit succeeds
- **AND** the submodule path still exists without an initialized `.git` checkout
- **THEN** prepare removes that residual directory before returning

#### Scenario: still-initialized path is not force-deleted on deinit failure
- **WHEN** deinit fails for a path that still looks initialized
- **THEN** prepare fails with `submodule_teardown_failed`
- **AND** does not silently delete the live submodule checkout

### Requirement: Finish retries worktree remove once after re-prepare on containment
When `git worktree remove` fails because the worktree still contains submodules after the first prepare, finish SHALL run prepare again and retry worktree removal **once**. If the second remove still fails for the same class of error, finish MUST fail with `submodule_teardown_failed` and an actionable remediation hint.

#### Scenario: first remove containment then success on retry
- **WHEN** the first worktree remove fails with a submodule containment error
- **AND** a second prepare + remove succeeds
- **THEN** finish succeeds and the worktree is removed

#### Scenario: containment persists after retry
- **WHEN** both remove attempts fail with submodule containment
- **THEN** the error code is `submodule_teardown_failed`
- **AND** the message guides manual deinit / retry finish
