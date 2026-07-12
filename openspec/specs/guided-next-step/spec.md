# guided-next-step Specification

## Purpose

Operator-driven next lifecycle step selection with hard-coded edges and UI/text menu.

## Requirements

### Requirement: Guided next-step entrypoint exists
The system SHALL provide an operator entrypoint (`/ops-next` skill and/or equivalent) that, given a change name, determines the current lifecycle station and presents allowed next actions.

#### Scenario: ops-next with change name
- **WHEN** the operator runs guided next-step for change `add-dark-mode`
- **THEN** the system computes a station and presents a finite list of next actions including stop

### Requirement: Legal edges are hard-coded by station
The system SHALL use a hard-coded mapping from station to allowed next actions. The mapping MUST include at least:

- `no_workspace` → ops-start, stop
- `ready_to_propose` → opsx-propose, stop
- `proposed` → ops-spec-review, opsx-apply, stop
- `applied` → ops-ship, stop
- `shipped` → ops-impl-review, ops-ship, ops-merge, stop
- `merged` → opsx-archive, stop
- `archived` → ops-finish, stop
- `done` → stop

The main guided menu MUST NOT offer `ops-spec-review` from `applied`.
The main guided menu MUST offer both `ops-impl-review` and `ops-ship` from `shipped`.

#### Scenario: applied menu excludes spec-review
- **WHEN** station is `applied`
- **THEN** guided options include ops-ship and stop
- **AND** do not include ops-spec-review

#### Scenario: shipped menu allows re-ship and impl-review
- **WHEN** station is `shipped`
- **THEN** guided options include ops-impl-review, ops-ship, ops-merge, and stop

### Requirement: UI select preferred with text fallback
When a UI select API is available and UI is present, the system SHALL present next actions via that select UI.
When UI is not available, the system SHALL print a textual numbered (or equivalently clear) menu and MUST NOT automatically execute a next lifecycle skill.

#### Scenario: has UI uses select
- **WHEN** guided next-step runs with UI select available
- **THEN** the operator is prompted with a selection list of allowed actions

#### Scenario: headless does not auto-continue
- **WHEN** guided next-step runs without UI
- **THEN** a text menu is shown
- **AND** no follow-up agent turn is scheduled solely to run the next skill without an explicit operator choice

### Requirement: No cross-step auto scheduling
The system MUST NOT schedule follow-up turns that run ops-spec-review, ops-impl-review, ops-finish, or worktree ensure solely because a prior step settled or succeeded, except when the operator explicitly chose that action through guided next-step or typed the command.

#### Scenario: ship success does not auto impl-review
- **WHEN** ship completes successfully
- **THEN** the system does not start ops-impl-review unless the operator selects it (or runs it manually)

#### Scenario: propose does not auto ensure or auto review
- **WHEN** the operator runs propose
- **THEN** the system does not automatically create a worktree ensure as a hidden pre-step
- **AND** does not automatically schedule ops-spec-review on settle without operator choice

### Requirement: In-step multi-round reviews remain allowed
ops-spec-review and ops-impl-review SHALL be allowed to run iterative fix loops within a single invocation subject to their max-rounds configuration. Guided next-step MUST NOT require a new operator selection between those in-step rounds.

#### Scenario: spec-review multi-round still valid
- **WHEN** the operator selects or runs ops-spec-review
- **THEN** that skill may perform multiple review-fix rounds inside that run

### Requirement: Nameless ops-next discovers and selects a change
When the guided next-step entrypoint is invoked **without** a parseable kebab-case change name, the system SHALL discover candidate active changes and:

- If **zero** candidates: notify the operator and MUST NOT schedule a next lifecycle skill
- If **one** candidate: use that change and proceed to the station next-action menu
- If **multiple** candidates: present a selection UI when available (`ctx.ui.select` or equivalent); when UI is unavailable, present a textual list and MUST NOT auto-select a change or auto-schedule a skill

When a change name **is** provided, the system SHALL skip change-picking and proceed to the station menu as today.

#### Scenario: no name and no candidates
- **WHEN** operator runs `/ops-next` with no change argument
- **AND** no candidate changes are discovered
- **THEN** the system notifies that no change is available
- **AND** does not schedule a lifecycle skill

#### Scenario: no name and one candidate
- **WHEN** operator runs `/ops-next` with no change argument
- **AND** exactly one candidate change `add-dark-mode` exists
- **THEN** the system uses `add-dark-mode` for the subsequent next-action menu

#### Scenario: no name and multiple candidates with UI
- **WHEN** operator runs `/ops-next` with no change argument
- **AND** multiple candidates exist
- **AND** UI select is available
- **THEN** the operator is prompted to pick a change name
- **AND** only after a choice does the station next-action menu run for that change

#### Scenario: no name and multiple candidates without UI
- **WHEN** operator runs `/ops-next` with no change argument
- **AND** multiple candidates exist
- **AND** UI select is unavailable
- **THEN** a textual list of candidates is shown
- **AND** no change is auto-selected and no skill is auto-scheduled

#### Scenario: explicit name skips pick
- **WHEN** operator runs `/ops-next add-dark-mode`
- **THEN** the system does not require a change-pick step before the station menu

### Requirement: Candidate discovery covers worktrees and active change dirs
Candidate discovery for nameless `/ops-next` SHALL include:

- Active `openspec/changes/<kebab>/` directories under resolved roots (excluding `archive/`)
- Change worktree directories under a `.worktrees/` parent (kebab leaf names)

Candidate discovery MUST NOT treat the basename of a package root, primary checkout, or other non-`.worktrees` root path as a change name solely because that basename matches kebab-case (e.g. must not list `openspec-ops` merely because the package is installed at a path ending in `openspec-ops`).

#### Scenario: active change dir is a candidate
- **WHEN** `openspec/changes/add-x/` exists under a resolved root and is not only under archive
- **THEN** `add-x` appears in the candidate list for nameless `/ops-next`

#### Scenario: worktree leaf is a candidate
- **WHEN** `<root>/.worktrees/ship-y/` exists as a directory
- **THEN** `ship-y` appears in the candidate list

#### Scenario: package root basename is not a candidate
- **WHEN** a resolved root path ends with `/openspec-ops` and is not itself a `.worktrees/openspec-ops` worktree path
- **AND** no active change dir or `.worktrees/<change>` entry exists for other names
- **THEN** the candidate list does not include `openspec-ops` solely from that root basename

#### Scenario: cwd under .worktrees still discovers the change
- **WHEN** a resolved root is `.../.worktrees/add-x`
- **THEN** `add-x` is included as a candidate via worktree-leaf detection


### Requirement: Station detection uses PR open/merged signals when available
When computing the lifecycle station for guided next-step, the system SHALL set open-PR and merged-PR signals from the PR backend (gh) for the change head branch when that lookup succeeds.

The system MUST NOT hardcode open/merged PR signals to false when a successful PR query is available.

If PR status cannot be determined (gh missing, network error, query failure), the system MAY treat open/merged as false (fail-open) and MUST still present a next-step menu without crashing.

#### Scenario: open PR yields shipped station options
- **WHEN** tasks are complete for the change
- **AND** an open PR exists for the change branch
- **AND** PR status is successfully queried
- **THEN** the guided station is `shipped` (or equivalent)
- **AND** next-action options include impl-review and merge (not only ship)

#### Scenario: merged PR yields merged station options
- **WHEN** a merged PR exists for the change branch
- **AND** the change is still active (not solely archived)
- **AND** PR status is successfully queried
- **THEN** the guided station is `merged` (or equivalent)
- **AND** next-action options include archive

#### Scenario: PR query failure is fail-open
- **WHEN** gh cannot provide PR status
- **THEN** `/ops-next` still completes a menu path without throwing
- **AND** open/merged signals may be treated as false
