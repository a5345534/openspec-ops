# pi-auto-impl-review-follow-up Specification

## Purpose

Auto-schedule ops-impl-review after successful ship when policy is on (default on).

## Requirements

### Requirement: Auto impl-review after successful ship with default on
The system SHALL support automatically scheduling the ops-impl-review entrypoint after a **successful** ship for a change when policy is not off.

Policy MUST be readable from `OPENSPEC_OPS_AUTO_IMPL_REVIEW` with values `on`|`off` (case-insensitive). **Default MUST be `on`.**

The body of the review remains the ops-impl-review skill (iterative fix+push loop), not a mechanical openspec-ops analyzer CLI.

#### Scenario: default on
- **WHEN** `OPENSPEC_OPS_AUTO_IMPL_REVIEW` is unset
- **THEN** auto impl-review policy behaves as `on`

#### Scenario: off disables auto schedule
- **WHEN** `OPENSPEC_OPS_AUTO_IMPL_REVIEW=off`
- **AND** ship succeeds
- **THEN** the system does not require scheduling ops-impl-review solely due to auto policy

#### Scenario: on schedules ops-impl-review after ship success
- **WHEN** policy is `on`
- **AND** ship completes successfully for change `add-dark-mode`
- **THEN** the operator-facing automation path schedules or continues into `/ops-impl-review add-dark-mode` (or equivalent)

### Requirement: Auto impl-review does not merge
Auto impl-review MUST NOT merge the pull request into the base branch.

#### Scenario: no merge as part of auto impl-review
- **WHEN** auto impl-review runs after ship
- **THEN** it does not perform merge into main as part of that gate

### Requirement: Impl-review push does not re-arm ship auto chain
Completing ops-impl-review (including push of fix commits) MUST NOT by itself require invoking `openspec-ops ship` again, and MUST NOT define success as re-entering ship solely to re-trigger auto impl-review.

#### Scenario: fix push is not a new ship requirement
- **WHEN** ops-impl-review pushes fix commits to an existing PR branch
- **THEN** success does not require a new ship command invocation

