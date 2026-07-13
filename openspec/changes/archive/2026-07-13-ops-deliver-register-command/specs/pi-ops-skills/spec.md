## ADDED Requirements

### Requirement: ops-deliver skill accepts extension-bound change name
The ops-deliver skill SHALL accept a change name supplied by an extension-injected follow-up message that explicitly binds the kebab-case change, and MUST NOT stop with a missing-name error when that binding is present.

#### Scenario: skill honors REQUIRED change binding line
- **WHEN** the follow-up message states the change name is `add-dark-mode` (or equivalent REQUIRED binding)
- **THEN** the skill proceeds with that change for the deliver pipeline
