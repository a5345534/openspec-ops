## MODIFIED Requirements

### Requirement: Return-to-main policy config key
`ops-config` SHALL support `finish.return-to-main` with values `off`, `primary-only`, and `required`. Its effective value SHALL resolve with session override first, then user-local preference, then environment `OPENSPEC_OPS_FINISH_RETURN_TO_MAIN`, then default `off`.

The built-in default MUST remain `off` (non-mutating primary). User or session values affect Pi-injected effective policy for skills/deliver; they MUST NOT by themselves change CLI `openspec-ops finish` flag defaults outside Pi policy injection.

Semantic mapping for consumers of the effective policy:
- `off` — do not pass primary sync or return-to-main flags unless the operator explicitly opts in.
- `primary-only` — pass primary checkout sync and recursive submodule pin update (`--sync-primary` and `--sync-submodules`); do not pass strict `--return-to-main` or attach-only flags solely due to this policy.
- `required` — pass strict composite `--return-to-main` and hard-stop on `return_to_main_needs_human`.

#### Scenario: session enables strict closeout
- **WHEN** the operator runs `/ops-config set finish.return-to-main required`
- **THEN** the injected effective configuration reports `required` with source `session`

#### Scenario: user preference enables primary-only without env
- **WHEN** no session override exists
- **AND** the user store sets `finish.return-to-main` to `primary-only`
- **AND** the environment variable is unset
- **THEN** the effective policy is `primary-only` with source `user`

#### Scenario: user preference enables strict closeout without env
- **WHEN** no session override exists
- **AND** the user store sets `finish.return-to-main` to `required`
- **AND** the environment variable is unset
- **THEN** the effective policy is `required` with source `user`

#### Scenario: environment provides persistent opt-in
- **WHEN** no session override and no user preference exist
- **AND** `OPENSPEC_OPS_FINISH_RETURN_TO_MAIN=required`
- **THEN** the effective policy is `required` with source `env`

#### Scenario: invalid policy is rejected
- **WHEN** an operator attempts to set `finish.return-to-main` to a value other than `off`, `primary-only`, or `required`
- **THEN** the command refuses to store the value

#### Scenario: default remains non-mutating
- **WHEN** neither session, user preference, nor environment configures the policy
- **THEN** the effective value is `off` with source `default`

#### Scenario: injection describes primary-only finish flags
- **WHEN** effective policy is `primary-only`
- **THEN** injected agent guidance states that final finish MUST use `--sync-primary` and `--sync-submodules` and MUST NOT use `--return-to-main` solely due to this policy
