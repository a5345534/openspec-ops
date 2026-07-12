## ADDED Requirements

### Requirement: Opt-in start path avoids long-lived detached submodule work
Documentation for submodule hygiene SHALL mention that operators MAY pass `--init-submodule-branches` on start so checked-out detached top-level submodules get a named branch matching the change before implementation, without auto-commit.

#### Scenario: hygiene docs mention the flag
- **WHEN** reading submodule hygiene or ops-start docs after this change
- **THEN** the opt-in start flag for submodule branches is described
