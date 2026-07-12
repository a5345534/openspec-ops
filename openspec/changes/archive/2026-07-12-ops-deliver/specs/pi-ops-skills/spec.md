## ADDED Requirements

### Requirement: ops-deliver skill is packaged
The package SHALL ship an `ops-deliver` skill (and prompt if used) describing start-to-finish orchestration, mandatory reviews, merge consent via invoke, resume behavior, and hard stops.

#### Scenario: skill exists under ops-deliver
- **WHEN** listing packaged ops skills after this change
- **THEN** an ops-deliver skill is present and documents mandatory spec-review and impl-review

### Requirement: README documents deliver vs next
The root README SHALL document `/ops-deliver` as the batch happy path after explore and `/ops-next` as the single-step menu.

#### Scenario: README mentions both
- **WHEN** reading the recommended loop after this change
- **THEN** both deliver and next are described without reviving retired AUTO_* env automation
