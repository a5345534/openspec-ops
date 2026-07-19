## ADDED Requirements

### Requirement: Return-to-main policy config key
`ops-config` SHALL support `finish.return-to-main` with values `off` and `required`. Its effective value SHALL resolve with session override first, then environment `OPENSPEC_OPS_FINISH_RETURN_TO_MAIN`, then default `off`.

#### Scenario: session enables strict closeout
- **WHEN** the operator runs `/ops-config set finish.return-to-main required`
- **THEN** the injected effective configuration reports `required` with source `session`

#### Scenario: environment provides persistent opt-in
- **WHEN** no session override exists
- **AND** `OPENSPEC_OPS_FINISH_RETURN_TO_MAIN=required`
- **THEN** the effective policy is `required` with source `env`

#### Scenario: invalid policy is rejected
- **WHEN** an operator attempts to set `finish.return-to-main` to a value other than `off` or `required`
- **THEN** the command refuses to store the value

#### Scenario: default remains non-mutating
- **WHEN** neither session nor environment configures the policy
- **THEN** the effective value is `off` with source `default`
