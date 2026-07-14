## ADDED Requirements

### Requirement: Default finish does not mutate primary checkout
Unless an explicit opt-in sync flag is passed, `openspec-ops finish` MUST NOT run `git pull`, `git switch`/`checkout` on the primary worktree, or `git submodule update` on the primary as part of successful closeout.

#### Scenario: default finish leaves primary HEAD unchanged
- **WHEN** finish succeeds without `--sync-primary`, `--sync-submodules`, or `--attach-submodule-main`
- **THEN** the primary worktree HEAD and branch are not updated by finish
- **AND** primary submodules are not updated by finish solely due to that invocation

---

### Requirement: Opt-in sync-primary is ff-only on clean primary
When finish is invoked with `--sync-primary`, after worktree/branch closeout steps that apply, the system SHALL attempt to place the primary worktree on the repository default base branch and fast-forward it to match `origin/<base>` (or equivalent remote-tracking base).

The system MUST refuse sync-primary when the primary worktree is dirty. The system MUST use non-force fast-forward only and MUST NOT force non-ff updates or rewrite history.

#### Scenario: clean primary fast-forwards
- **WHEN** finish runs with `--sync-primary`
- **AND** the primary worktree is clean
- **AND** primary can fast-forward to `origin/<base>`
- **THEN** primary ends on the base branch at the fast-forwarded tip
- **AND** no force push or hard reset of unrelated history is performed

#### Scenario: dirty primary refuses sync-primary
- **WHEN** finish runs with `--sync-primary`
- **AND** the primary worktree is dirty
- **THEN** primary is not pulled or switched as part of sync-primary
- **AND** the invocation reports a clear sync failure distinct from worktree removal success when the worktree was already removed

#### Scenario: diverged primary refuses non-ff
- **WHEN** finish runs with `--sync-primary`
- **AND** primary and `origin/<base>` have diverged such that ff-only pull cannot proceed
- **THEN** the system does not force the update
- **AND** reports a clear non-ff / diverged failure

---

### Requirement: Opt-in sync-submodules updates primary pins
When finish is invoked with `--sync-submodules`, the system SHALL run a primary-scoped submodule update that initializes and checks out gitlink pins (`git submodule update --init --recursive` as documented for the flag) on the primary worktree.

Default finish without the flag MUST NOT perform that primary submodule update.

#### Scenario: sync-submodules updates pins on primary
- **WHEN** finish runs with `--sync-submodules`
- **AND** primary has top-level submodules
- **THEN** submodule checkouts on primary are updated to the parent gitlink pins via submodule update
- **AND** the operation does not require attaching submodules to a named branch

---

### Requirement: Attach submodule to main only when non-destructive
When finish is invoked with `--attach-submodule-main`, for each applicable top-level submodule on primary the system SHALL switch that submodule to branch `main` (or the documented default submodule branch) and fast-forward to the gitlink **only if** the gitlink equals the branch tip or is a fast-forward reachable commit without force.

If the submodule branch and gitlink have diverged, the system MUST leave the submodule detached at the pin (or unchanged from update result), MUST NOT force-reset or force-push, and MUST report a diverged warning or result field (`submodule_main_diverged` or equivalent).

#### Scenario: attach when gitlink matches main
- **WHEN** finish runs with `--attach-submodule-main`
- **AND** submodule `origin/main` or local `main` tip equals the parent gitlink
- **THEN** the submodule is on branch `main` at that commit

#### Scenario: diverged submodule is not force-attached
- **WHEN** finish runs with `--attach-submodule-main`
- **AND** submodule `main` and the gitlink have diverged
- **THEN** history is not rewritten
- **AND** a diverged condition is reported
- **AND** the submodule remains at the pin without forced branch move

---

### Requirement: Closeout hints remain available without sync flags
Successful finish JSON (schemaVersion 1) SHALL be able to include residual closeout hint fields (or equivalent structured warnings) indicating when primary appears behind `origin/<base>` after default closeout, without requiring sync flags.

Absence of remote-tracking data MUST NOT fail finish solely for missing hints.

#### Scenario: finish can hint primary behind without syncing
- **WHEN** finish succeeds without sync flags
- **AND** primary is detectably behind `origin/<base>` using local remote-tracking refs
- **THEN** the result or user-visible output indicates primary lag as a hint
- **AND** primary is still not mutated by finish

---

### Requirement: Sync does not merge or archive
Primary/submodule sync paths MUST NOT merge pull requests and MUST NOT archive OpenSpec changes.

#### Scenario: sync flags are not merge
- **WHEN** finish runs with any sync flag
- **THEN** it does not merge a PR as part of sync
- **AND** it does not archive an OpenSpec change as part of sync
