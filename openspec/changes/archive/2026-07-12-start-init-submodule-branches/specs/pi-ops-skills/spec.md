## ADDED Requirements

### Requirement: ops-start documents init-submodule-branches
The ops-start skill/prompt SHALL document optional `--init-submodule-branches` for monorepos with submodules.

#### Scenario: skill mentions flag
- **WHEN** reading ops-start after this change
- **THEN** it mentions `--init-submodule-branches` or equivalent
