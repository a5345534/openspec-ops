## ADDED Requirements

### Requirement: Ops skills consume the effective return-to-main policy
Packaged `ops-deliver` and `ops-finish` instructions SHALL explain the effective `finish.return-to-main` policy. `ops-deliver` SHALL map `required` to the strict `--return-to-main` finish invocation and SHALL map `off` to the existing non-mutating finish invocation.

#### Scenario: required policy appears in agent context
- **WHEN** effective config injection states `finish.return-to-main=required`
- **THEN** the deliver instructions require `--return-to-main` at finish
- **AND** require a hard stop on structured strict-closeout failure

#### Scenario: off policy preserves current behavior
- **WHEN** effective config injection states `finish.return-to-main=off`
- **THEN** deliver instructions prohibit adding return-to-main or legacy sync flags unless separately requested
