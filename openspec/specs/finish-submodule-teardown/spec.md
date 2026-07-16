# finish-submodule-teardown Specification

## Purpose

Finish tears down change worktrees that contain initialized top-level submodules by deinit before worktree remove.

## Requirements

### Requirement: Finish removes worktrees that contain initialized top-level submodules
When `openspec-ops finish` runs against a registered change worktree that contains one or more **initialized or deinitialized top-level submodule gitlinks**, the system SHALL prepare the worktree for removal and remove a verified-clean worktree successfully. If Git requires force solely for structural submodule containment, the system SHALL use controlled internal structural force without requiring operator `--force` and without treating it as permission to discard dirty data.

#### Scenario: clean initialized submodule worktree finishes
- **WHEN** the change worktree and its initialized top-level submodules are clean
- **AND** the user runs `openspec-ops finish <change> --json` without `--force`
- **THEN** the command exits successfully
- **AND** the worktree is no longer registered
- **AND** the result does not claim operator-authorized dirty discard

#### Scenario: clean deinitialized submodule worktree finishes
- **WHEN** a clean change worktree contains a deinitialized top-level submodule gitlink
- **AND** Git requires structural force to remove the worktree
- **THEN** finish completes without operator `--force`
- **AND** does not discard uncommitted data

---

### Requirement: Dirty worktree still requires force
Finish MUST refuse a dirty parent or submodule worktree without operator `--force`. Internal structural force MUST NOT be used unless the target is freshly verified clean after preparation.

#### Scenario: dirty parent without force is blocked
- **WHEN** the parent worktree is dirty
- **AND** finish is invoked without `--force`
- **THEN** the command fails with `worktree_dirty`
- **AND** the worktree is not removed

#### Scenario: dirty submodule without force is blocked
- **WHEN** an initialized submodule contains uncommitted changes
- **AND** finish is invoked without `--force`
- **THEN** the command fails with `worktree_dirty`
- **AND** internal structural force is not attempted

#### Scenario: target becomes dirty after preparation
- **WHEN** ordinary removal reports submodule containment
- **AND** the fresh pre-structural-force check reports the target dirty
- **THEN** finish refuses structural force
- **AND** reports a retryable dirty-worktree failure

---

### Requirement: Submodule teardown failure is actionable
If submodule preparation fails and the worktree cannot be removed because of submodules, finish MUST fail with stable error code **`submodule_teardown_failed`** (not only a bare unstructured `git_failed` when the cause is known to be submodule teardown), and MUST include a message or hint that guides deinit/removal remediation.

#### Scenario: teardown failure surfaces hint
- **WHEN** submodule deinit/preparation fails and remove cannot proceed
- **THEN** the error uses code `submodule_teardown_failed` when the failure is attributed to submodule teardown
- **AND** suggests remediation involving submodule deinit or manual worktree remove

### Requirement: Prepare preserves clean gitlink worktree state
When preparation deinitializes a top-level submodule, it SHALL preserve the resulting hollow gitlink directory rather than deleting the tracked submodule path. Preparation MUST NOT turn an initially clean worktree into a synthetic ` D <submodule>` state merely to attempt ordinary removal.

#### Scenario: successful deinit leaves hollow path clean
- **WHEN** preparation deinitializes a clean top-level submodule
- **THEN** the hollow submodule path remains present
- **AND** the parent worktree remains clean for structural verification

#### Scenario: already-deinitialized path is preserved
- **WHEN** a listed submodule path exists without an initialized `.git` checkout
- **THEN** preparation does not recursively delete that path
- **AND** does not manufacture parent worktree dirtiness

### Requirement: Finish uses controlled structural force after containment
When ordinary `git worktree remove` fails with a recognized submodule containment error after preparation, finish SHALL freshly verify the target is clean and retry removal exactly once using Git's structural force mechanism. It MUST NOT repeat preparation or delete hollow gitlink paths as a substitute for structural removal. If the controlled retry fails, finish SHALL preserve stable actionable error behavior.

#### Scenario: ordinary remove containment then structural success
- **WHEN** preparation has completed
- **AND** ordinary worktree removal fails with recognized submodule containment
- **AND** the target remains clean
- **AND** controlled structural removal succeeds
- **THEN** finish succeeds without operator `--force`

#### Scenario: structural retry still reports containment
- **WHEN** controlled structural removal also fails with submodule containment
- **THEN** finish fails with `submodule_teardown_failed`
- **AND** includes actionable remediation

#### Scenario: structural retry returns another Git error
- **WHEN** controlled structural removal fails for a reason other than submodule containment
- **THEN** finish preserves that error rather than relabeling it as teardown containment
