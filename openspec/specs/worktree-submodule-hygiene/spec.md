# worktree-submodule-hygiene Specification

## Purpose

Observability and documentation for git submodule detached/dirty state under openspec-ops change worktrees (top-level only; no auto-commit or auto-branch).
## Requirements
### Requirement: Document parent vs submodule branch model
The system SHALL document that an openspec-ops change worktree places the **parent** repository on a named change branch, while nested git submodules may remain on **detached HEAD** at the parent’s recorded gitlink SHA, and that long-lived implementation work MUST NOT stay on detached submodule HEAD.

Documentation SHALL describe the recommended manual order: create/switch a branch in the submodule → commit in the submodule → update and commit the parent gitlink → then ship/PR as usual.

#### Scenario: README or snippet explains parent vs submodule
- **WHEN** reading project documentation for worktree lifecycle or write alignment after this change
- **THEN** it states that parent branch and submodule branch are distinct
- **AND** it warns against long-lived work on detached submodule HEAD

---

### Requirement: Top-level submodule probe is read-only and bounded
When inspecting a change worktree for submodule hygiene, the system SHALL consider only **top-level** submodule paths declared for that worktree (e.g. via `.gitmodules` under the worktree root) and MUST NOT require recursive nested submodule traversal in this capability.

Probe operations MUST be read-only (no `switch`, commit, or gitlink update).

#### Scenario: no submodules means no submodule issues
- **WHEN** doctor or where inspects a worktree with no top-level submodules
- **THEN** no submodule-hygiene issues are reported for that worktree
- **AND** overall command success is unaffected

#### Scenario: probe does not mutate git state
- **WHEN** submodule probe runs for a worktree
- **THEN** it does not create branches, commits, or update gitlinks

---

### Requirement: Doctor reports detached and detached-dirty submodules
Doctor SHALL report issues when a registered change worktree has a top-level submodule on detached HEAD:

- `submodule_detached` at **info** severity when detached and not dirty
- `submodule_detached_dirty` at **warning** severity when detached and dirty

Issue identifiers MUST be stable as above and include a hint to branch + commit in the submodule before force-finish.

Doctor MUST NOT require a separate issue class for submodules that are attached to a branch but dirty (v1); parent dirty detection and finish remain the primary gate for that case.

#### Scenario: detached dirty submodule yields warning-class issue
- **WHEN** doctor runs
- **AND** a linked worktree has a top-level submodule that is detached and dirty
- **THEN** an issue with id `submodule_detached_dirty` is reported with warning severity for that path

#### Scenario: clean detached submodule yields info-class issue
- **WHEN** doctor runs
- **AND** a linked worktree has a top-level submodule that is detached and clean
- **THEN** an issue with id `submodule_detached` is reported with info severity

#### Scenario: attached dirty submodule is not a dedicated hygiene issue
- **WHEN** doctor runs
- **AND** a top-level submodule is on a branch (not detached) and dirty
- **THEN** doctor does not require emitting `submodule_detached` or `submodule_detached_dirty` for that submodule solely due to dirtiness

#### Scenario: doctor remains fail-open on probe errors
- **WHEN** probing one submodule fails
- **THEN** doctor still completes for other worktrees/issues
- **AND** does not treat that failure as a fatal CLI error solely due to submodule probe

---

### Requirement: Where enrichment lists submodule states
On successful `where`, the result object SHALL include a `submodules` array describing top-level submodule path, detached flag, dirty flag, and branch name when attached (null when detached).

The array MUST be `[]` when there are no top-level submodules. schemaVersion remains 1.

#### Scenario: where without submodules includes empty array
- **WHEN** `openspec-ops where <change> --json` succeeds for a worktree without submodules
- **THEN** the response is ok with schemaVersion 1
- **AND** `result.submodules` is `[]`

---

### Requirement: Finish dirty messaging mentions submodule risk
When finish refuses a dirty worktree without `--force`, the user-visible message SHALL note that dirtiness may include submodule changes and that `--force` can discard uncommitted work (including inside submodules).

Finish MUST NOT auto-commit submodule or parent changes, and MUST NOT pass `--force` without explicit user consent (existing policy).

#### Scenario: dirty finish message does not imply auto-commit
- **WHEN** finish is refused because the worktree is dirty
- **THEN** the message does not claim openspec-ops committed submodule work
- **AND** mentions dirty state and submodule-related risk

---

### Requirement: No automatic submodule branch or commit in this capability
This capability MUST NOT implement automatic `git switch -c` (or equivalent) inside submodules at **start** time without an explicit opt-in flag, and MUST NOT auto-commit in submodules or update parent gitlinks as part of doctor/where/**default** finish happy paths.

Opt-in finish primary closeout flags defined by `primary-closeout-sync` (`--sync-primary`, `--sync-submodules`, `--attach-submodule-main`) MAY mutate the **primary** checkout and its submodule work trees only when those flags are explicitly passed; they MUST remain default-off and MUST NOT auto-commit parent gitlink updates as a side effect of attach alone beyond documented switch/ff-to-pin behavior.

#### Scenario: start without submodule mutation flag
- **WHEN** `openspec-ops start` runs without a future opt-in submodule-branch flag
- **THEN** success does not require creating branches inside submodules

#### Scenario: default finish does not run primary submodule sync
- **WHEN** finish runs without primary closeout sync flags
- **THEN** finish does not require updating primary submodule checkouts or attaching them to `main`

---

### Requirement: Ship respects detached-dirty submodule preflight
When ship runs against a change worktree, it SHALL use top-level submodule probe results and MUST abort if any top-level submodule is detached and dirty, consistent with not committing ambiguous parent state.

#### Scenario: ship aborts on detached dirty submodule
- **WHEN** ship is invoked
- **AND** a top-level submodule under the worktree is detached and dirty
- **THEN** ship does not complete a successful parent commit+PR for that invocation

---

### Requirement: Finish closeout documents submodule worktrees
Project documentation for finish/closeout SHALL note that change worktrees may contain submodules and that finish performs submodule-aware teardown (deinit as needed) before worktree removal, while dirty trees still require commit/stash or explicit `--force`.

#### Scenario: README or finish help mentions submodule teardown
- **WHEN** reading finish or submodule closeout documentation after this change
- **THEN** it mentions submodule-aware finish or deinit-before-remove behavior

### Requirement: Opt-in start path avoids long-lived detached submodule work
Documentation for submodule hygiene SHALL mention that operators MAY pass `--init-submodule-branches` on start so checked-out detached top-level submodules get a named branch matching the change before implementation, without auto-commit.

#### Scenario: hygiene docs mention the flag
- **WHEN** reading submodule hygiene or ops-start docs after this change
- **THEN** the opt-in start flag for submodule branches is described

### Requirement: Document detached-at-gitlink as normal after primary update
Project documentation for monorepo closeout SHALL state that after `git submodule update` on primary, a top-level submodule on **detached HEAD at the parent gitlink** is standard Git behavior (pin is source of truth), and MUST NOT describe that state alone as deliver or finish corruption.

#### Scenario: docs distinguish pin detach from broken HEAD
- **WHEN** reading submodule or deliver closeout documentation after this change
- **THEN** it states detached-at-gitlink on primary is expected after submodule update
- **AND** it does not instruct operators to treat clean pin detach as a failed deliver by itself

---

### Requirement: Doctor reports primary submodule pin hygiene
Doctor SHALL probe top-level submodules under the **primary** worktree (in addition to linked change worktrees) and report:

- `primary_submodule_detached` at **info** when a primary top-level submodule is detached and clean
- `primary_submodule_detached_dirty` at **warning** when a primary top-level submodule is detached and dirty

Probe MUST remain read-only and fail-open. Existing linked-worktree issue ids (`submodule_detached`, `submodule_detached_dirty`) remain for change worktrees.

#### Scenario: clean detached primary submodule is info
- **WHEN** doctor runs
- **AND** a top-level submodule under primary is detached and clean
- **THEN** an issue with id `primary_submodule_detached` and severity `info` is reported for that path

#### Scenario: dirty detached primary submodule is warning
- **WHEN** doctor runs
- **AND** a top-level submodule under primary is detached and dirty
- **THEN** an issue with id `primary_submodule_detached_dirty` and severity `warning` is reported

#### Scenario: primary probe failure is fail-open
- **WHEN** probing a primary submodule fails
- **THEN** doctor still completes for other checks
- **AND** does not fail solely due to that probe error

### Requirement: Matching submodule branch probe is bounded and read-only
The system SHALL provide a fail-open probe for a supplied expected branch name across checked-out top-level submodules declared by the parent worktree. The probe SHALL inspect only local branch refs, configured remote names, corresponding local remote-tracking refs, and the current symbolic branch.

The probe MUST NOT recurse into nested submodules, fetch, contact a remote service, switch branches, delete refs, commit, push, or update parent gitlinks.

#### Scenario: local matching branch exists
- **WHEN** a checked-out top-level submodule contains `refs/heads/<expected>`
- **THEN** the probe emits `submodule_change_branch_local`
- **AND** identifies whether that branch is currently checked out

#### Scenario: matching remote-tracking ref exists
- **WHEN** a configured submodule remote has a local `refs/remotes/<remote>/<expected>` ref
- **THEN** the probe emits `submodule_change_branch_remote_tracking`
- **AND** identifies the remote name
- **AND** does not claim it queried the live remote

#### Scenario: multiple top-level submodules and remotes
- **WHEN** multiple checked-out top-level submodules or configured remotes contain matching refs
- **THEN** the probe emits a separate bounded entry for each observed ref

#### Scenario: no submodules or refs
- **WHEN** no checked-out top-level submodule has an observable matching ref
- **THEN** the probe returns an empty array

#### Scenario: individual probe failure
- **WHEN** one submodule or Git ref query fails
- **THEN** the probe continues fail-open for other submodules
- **AND** does not fail lifecycle closeout solely due to diagnostics

### Requirement: Submodule branch diagnostics use stable scoped codes
Submodule branch diagnostics SHALL use stable codes `submodule_change_branch_local` and `submodule_change_branch_remote_tracking`. Each entry SHALL include submodule path and branch; remote-tracking entries SHALL include the remote name. Diagnostic wording and documentation MUST distinguish these refs from the parent repository's branch cleanup.

#### Scenario: operator reads finish JSON
- **WHEN** finish returns matching submodule branch diagnostics
- **THEN** each entry can be attributed to a specific submodule path and repository ref class
- **AND** cannot be mistaken for evidence that parent branch cleanup failed

