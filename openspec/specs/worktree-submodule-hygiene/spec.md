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
This capability MUST NOT implement automatic `git switch -c` (or equivalent) inside submodules at start time, and MUST NOT auto-commit in submodules or update parent gitlinks as part of doctor/where/finish happy paths.

#### Scenario: start without submodule mutation flag
- **WHEN** `openspec-ops start` runs without a future opt-in submodule-branch flag
- **THEN** success does not require creating branches inside submodules

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

