# primary-closeout-sync Specification

## Purpose
TBD - created by archiving change finish-closeout-return-to-main. Update Purpose after archive.
## Requirements
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

### Requirement: Composite return-to-main closeout is explicit and strict
`openspec-ops finish` SHALL accept `--return-to-main` as an explicit composite closeout request. It SHALL require a clean primary checkout, synchronize the primary base branch ff-only after lifecycle-created remote commits exist, update initialized submodules to superproject gitlinks, and safely attach eligible initialized submodules recursively to resolved remote default branches. It MUST NOT use hard reset, force branch replacement, force push, auto-commit, or discard local work.

#### Scenario: strict happy path
- **WHEN** finish runs with `--return-to-main`
- **AND** primary and all initialized submodules recursively are clean and compatible
- **THEN** primary ends on the resolved base branch at `origin/<base>`
- **AND** each reported submodule HEAD equals its superproject gitlink
- **AND** each eligible initialized submodule, including nested submodules, is attached to its resolved remote default branch
- **AND** the superproject remains clean

#### Scenario: default remains unchanged
- **WHEN** finish runs without `--return-to-main` and without existing sync flags
- **THEN** it does not mutate primary or primary submodule checkout state

### Requirement: Strict closeout resolves submodule remote defaults
The system SHALL recursively inventory initialized submodules and resolve each applicable submodule's remote default branch rather than assuming `main`. It SHALL fetch current remote metadata before evaluating compatibility. A missing or unavailable remote default SHALL be a non-success strict outcome.

#### Scenario: nested non-main remote default
- **WHEN** an initialized nested submodule remote HEAD resolves to `origin/master`
- **AND** `origin/master` is compatible with the parent gitlink
- **THEN** the submodule is attached to local branch `master` at the gitlink

#### Scenario: remote default unavailable
- **WHEN** a submodule remote default branch cannot be resolved
- **THEN** strict closeout fails with `return_to_main_needs_human`
- **AND** identifies that submodule with attach outcome `default_unresolved`

### Requirement: Submodule attachment preserves history and parent pins
The system SHALL attach a submodule only when its remote default tip equals the parent gitlink or is an ancestor that can fast-forward exactly to the gitlink. Existing local branches MUST NOT be replaced. If the remote default is ahead of or diverged from the gitlink, the system SHALL leave the checkout at the parent pin and fail strict closeout.

#### Scenario: default branch fast-forwards to gitlink
- **WHEN** the remote default tip is an ancestor of the parent gitlink
- **THEN** the local default branch may be created or fast-forwarded to exactly the gitlink
- **AND** no reset or force is used

#### Scenario: default branch ahead of gitlink
- **WHEN** the remote default branch contains commits beyond the parent gitlink
- **THEN** the system does not move the superproject gitlink or rewind the submodule branch
- **AND** fails with `return_to_main_needs_human`
- **AND** reports attach outcome `incompatible_default`

#### Scenario: dirty submodule fails closed
- **WHEN** an initialized submodule contains local changes during strict closeout
- **THEN** the system does not switch or update that submodule
- **AND** fails with structured diagnostics without discarding work

### Requirement: Return-to-main results expose final state
Successful finish JSON SHALL report the strict policy state, final primary branch and HEAD, and for each applicable initialized submodule recursively its path, branch, HEAD, gitlink, resolved remote default branch, and attach outcome. Strict failures SHALL expose the available snapshot and whether the change worktree was already removed in structured error details.

#### Scenario: successful structured result
- **WHEN** strict return-to-main succeeds
- **THEN** `result.sync.required` is true
- **AND** `result.sync.primary` identifies the final base branch and HEAD
- **AND** every `result.sync.submodules[]` row contains final branch, HEAD, gitlink, remote default branch, and attach outcome

#### Scenario: incompatible structured failure
- **WHEN** any required submodule cannot safely attach at its parent gitlink
- **THEN** the JSON error code is `return_to_main_needs_human`
- **AND** error details include per-submodule outcomes and `worktreeRemoved`

