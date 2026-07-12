## ADDED Requirements

### Requirement: ops-merge skill and prompt exist
Package-exported ops skills/prompts SHALL include `ops-merge` that instructs the agent to run `openspec-ops merge <change> --json` only when the user explicitly requested merging, and that ship/impl-review paths must not call merge without that request.

#### Scenario: ops-merge skill documents merge CLI
- **WHEN** reading the ops-merge skill
- **THEN** it includes `openspec-ops merge` with `--json` and checks/squash guidance

#### Scenario: skill forbids unsolicited merge
- **WHEN** the user only asked to ship or impl-review
- **THEN** the ops-merge skill instructions require not invoking merge
