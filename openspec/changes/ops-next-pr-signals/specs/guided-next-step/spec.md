## ADDED Requirements

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
