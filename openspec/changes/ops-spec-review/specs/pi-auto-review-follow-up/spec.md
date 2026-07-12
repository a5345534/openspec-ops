## MODIFIED Requirements

### Requirement: Follow-up turn review gate without mechanical review CLI
The system SHALL provide a Pi extension path that schedules a **new agent turn** to run the plan/spec review entrypoint after propose artifacts are ready.

The extension MUST NOT implement a mechanical `openspec-ops review` CLI as the review body for this capability.

The scheduled follow-up message MUST invoke **`/ops-spec-review`** for the change (not `/ops-review`), so the **full** iterative review-fix skill runs (including direct artifact edits across rounds)—not a read-only one-shot review.

#### Scenario: Review body remains skill entrypoint
- **WHEN** the gate fires a follow-up review for change `add-dark-mode`
- **THEN** the scheduled user message invokes `/ops-spec-review add-dark-mode` (or equivalent ops-spec-review entrypoint)
- **AND** the extension does not perform cross-artifact review analysis itself

#### Scenario: Follow-up is full review-fix not read-only
- **WHEN** auto-review schedules ops-spec-review after propose
- **THEN** the intended skill behavior includes fixing major findings in artifacts when needed within max rounds

#### Scenario: Propose input is not cancelled by review arm
- **WHEN** the user submits `/opsx-propose add-dark-mode` and review policy is `on`
- **THEN** the original propose input is not cancelled solely due to arming review
- **AND** the extension does not return a handled/cancel action solely for review arming
