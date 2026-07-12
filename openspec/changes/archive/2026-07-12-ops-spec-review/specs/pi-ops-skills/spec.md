## ADDED Requirements

### Requirement: ops-spec-review skill and prompt are shipped
Package-exported Pi skills/prompts SHALL include `ops-spec-review` describing the iterative plan/spec review-fix loop and worktree-aligned change resolution.

#### Scenario: ops-spec-review skill present
- **WHEN** inspecting package ops-* skills after this change
- **THEN** an ops-spec-review skill exists and mentions major/minor findings and max rounds

### Requirement: ops-review skill and prompt are removed
The package MUST NOT ship `ops-review` skill or `ops-review` prompt after this change; plan/spec review is only via `ops-spec-review`.

#### Scenario: ops-review paths absent from package surface
- **WHEN** inspecting package-exported ops skills/prompts after this change
- **THEN** there is no ops-review skill directory or ops-review prompt file

#### Scenario: README names ops-spec-review as the gate
- **WHEN** reading README loop documentation after this change
- **THEN** the propose→apply quality gate is named ops-spec-review (or /ops-spec-review)
