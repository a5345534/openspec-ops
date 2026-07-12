## ADDED Requirements

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
