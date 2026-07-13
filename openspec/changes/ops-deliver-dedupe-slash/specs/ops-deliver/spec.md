## ADDED Requirements

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
