# ops-deliver Specification

## Purpose

Batch start-to-finish lifecycle after explore with mandatory reviews and merge-on-invoke consent.

## Requirements

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

### Requirement: Extension command binds change name for slash ops-deliver
The Pi extension SHALL register an `ops-deliver` command that parses a kebab-case change name from slash command arguments (or candidate pick when the name is omitted and candidates exist) and schedules the ops-deliver skill follow-up with that name **explicitly bound** in the follow-up message.

The system MUST NOT require the agent to rediscover the change name solely from an empty args payload when the operator already passed a valid name on the slash line.

#### Scenario: slash with name schedules deliver for that change
- **WHEN** the operator runs `/ops-deliver eve-via-litellm-gateway`
- **AND** the extension is loaded
- **THEN** a follow-up is scheduled that states the change name is `eve-via-litellm-gateway`
- **AND** the agent is instructed not to claim the change name is missing

#### Scenario: slash without name uses candidate pick when available
- **WHEN** the operator runs `/ops-deliver` with no change argument
- **AND** candidate changes exist
- **THEN** the extension prompts to pick a change (or uses the sole candidate)
- **AND** then schedules deliver for the chosen name

#### Scenario: slash without name and no candidates
- **WHEN** the operator runs `/ops-deliver` with no change argument
- **AND** no candidates are discovered
- **THEN** the extension notifies usage / how to start
- **AND** does not schedule a deliver pipeline

### Requirement: Single slash surface for ops-deliver
The package SHALL expose at most one invokable slash command named `ops-deliver` from the openspec-ops package resources: the guided extension `registerCommand("ops-deliver")`.

The package MUST NOT ship a prompt template file that registers the same slash name `ops-deliver` (e.g. `.pi/prompts/ops-deliver.md`).

The ops-deliver skill MAY remain available as a skill (including `/skill:ops-deliver`) for agent-loaded instructions.

#### Scenario: no packaged prompt collides with extension command
- **WHEN** the openspec-ops package is installed from a release that includes this change
- **THEN** package files do not include `.pi/prompts/ops-deliver.md`
- **AND** the extension still registers `ops-deliver` for slash invocation with change-name binding

#### Scenario: skill instructions remain available
- **WHEN** an agent loads the ops-deliver skill
- **THEN** full pipeline instructions are still present under `.pi/skills/ops-deliver/`
