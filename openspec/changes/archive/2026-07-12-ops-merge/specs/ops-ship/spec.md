## ADDED Requirements

### Requirement: Ship remains non-merging while ops-merge exists
Even when a merge command exists in the product, `openspec-ops ship` MUST NOT merge the pull request as part of ship success.

#### Scenario: ship success does not merge
- **WHEN** ship completes successfully
- **THEN** the PR is not merged solely by the ship command
