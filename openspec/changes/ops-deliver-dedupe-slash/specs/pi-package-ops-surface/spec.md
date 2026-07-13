## ADDED Requirements

### Requirement: ops-deliver prompt not on package export surface
The package `files` allowlist SHALL include the ops-deliver skill directory and SHALL NOT list `.pi/prompts/ops-deliver.md`.

#### Scenario: files list has skill without deliver prompt
- **WHEN** `package.json` `files` is inspected
- **THEN** an entry covering `.pi/skills/ops-deliver` is present
- **AND** `.pi/prompts/ops-deliver.md` is absent from `files`
