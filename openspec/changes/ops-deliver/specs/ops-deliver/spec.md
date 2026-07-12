## ADDED Requirements

### Requirement: ops-deliver orchestrates start through finish after explore
The system SHALL provide an operator entrypoint `/ops-deliver` (skill/prompt) that, given a kebab-case change name, orchestrates the default lifecycle from worktree start through finish for that change.

Deliver MUST NOT perform open-ended explore. Explore is out of scope for this entrypoint.

#### Scenario: deliver requires change name
- **WHEN** the operator invokes deliver without a parseable change name
- **THEN** the system asks for or rejects until a kebab-case name is provided
- **AND** does not invent a change name silently

### Requirement: Default pipeline order
Unless already past a station (resume), deliver SHALL advance in this order:

start → propose → spec-review → apply → ship → impl-review → merge → archive → finish

#### Scenario: happy path order
- **WHEN** deliver runs on a change with no worktree and no artifacts
- **THEN** it attempts start and propose before apply and ship
- **AND** runs archive only after merge success (or already merged)

### Requirement: Spec-review and impl-review are mandatory
Deliver MUST run ops-spec-review after propose artifacts are ready and before apply proceeds, and MUST run ops-impl-review after ship and before merge.

Deliver MUST NOT provide a skip-review mode in v1.

If either review ends in needs-human (or equivalent non-ready), deliver MUST stop without merge.

#### Scenario: spec-review blocks apply and merge
- **WHEN** spec-review does not reach ready for apply
- **THEN** deliver does not proceed to apply or later merge in that run

#### Scenario: impl-review blocks merge
- **WHEN** ship has succeeded and impl-review does not reach ready for human merge
- **THEN** deliver does not merge the PR in that run

### Requirement: Deliver invoke authorizes merge when gates pass
Invoking deliver SHALL constitute operator consent to squash-merge the change PR when ship has succeeded, impl-review is ready, and merge checks policy allows.

Deliver MUST call merge without requiring a separate `/ops-merge` confirmation step.

#### Scenario: merge runs without second prompt
- **WHEN** station is ready to merge under deliver rules
- **THEN** deliver invokes merge as part of the same deliver operation consent model

#### Scenario: checks failure stops deliver
- **WHEN** merge fails due to checks_failed
- **THEN** deliver stops and does not archive or finish

### Requirement: Resume from current station
Re-invoking deliver for the same change SHALL continue from the current lifecycle station rather than restarting from start when work is already partially done.

#### Scenario: already shipped resumes at impl-review
- **WHEN** the change already has an open PR and tasks are complete
- **THEN** deliver does not require re-propose
- **AND** proceeds with mandatory impl-review before merge

### Requirement: No force finish in v1
Deliver MUST NOT pass `--force` to finish. If finish fails due to dirty worktree, deliver MUST stop.

#### Scenario: dirty finish stops pipeline
- **WHEN** finish would require `--force` because the worktree is dirty
- **THEN** deliver does not force-remove
- **AND** stops with guidance

### Requirement: Coexists with ops-next
Deliver MUST NOT remove or disable `/ops-next` single-step selection. Operators MAY use ops-next when deliver stops or instead of deliver.

#### Scenario: next remains available
- **WHEN** deliver stops on needs-human
- **THEN** documentation or messaging MAY point at `/ops-next` for manual continuation
