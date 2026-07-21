## ADDED Requirements

### Requirement: User-local preference store
The system SHALL support a user-local preference store for known ops-config keys under the Pi agent directory (not in the repository). User preferences MUST persist across Pi process restarts. The store MUST NOT be required for normal lifecycle operation when absent. Invalid or unknown keys in the file MUST be ignored without failing lifecycle actions.

#### Scenario: user preference survives restart boundary
- **WHEN** a user preference sets `finish.return-to-main` to `required`
- **AND** no session override exists
- **THEN** a new Pi session that loads the same agent directory reports effective `required` with source `user`

#### Scenario: missing user file is inert
- **WHEN** no user preference file exists
- **THEN** effective resolution uses session, env, and default only
- **AND** lifecycle commands still run

### Requirement: Explicit user write and clear
ops-config SHALL provide a direct way to write and remove user preferences for known keys (for example `set --user` / `unset --user`) without creating a project config file. Clearing all user preferences SHALL be available and MUST NOT delete metrics JSONL or SQLite data.

#### Scenario: set user preference via direct command
- **WHEN** the operator sets `finish.return-to-main` to `required` in the user store via the documented direct command form
- **THEN** the effective value is `required` with source `user` when no session override exists

#### Scenario: unset user preference
- **WHEN** a user preference for a key is unset
- **AND** no session override exists
- **THEN** effective resolution falls back to env (if set) or default

#### Scenario: clear user does not touch metrics
- **WHEN** the operator clears user ops-config preferences
- **THEN** metrics collection files and SQLite projections are left intact

### Requirement: Config menu can edit session or user scope
When the config guided menu is used to change a known key, the operator SHALL be able to choose whether the value applies to the **current session only** or to the **user preference store**. Session-only writes MUST NOT update the user store. User writes MUST persist as specified for the user store.

#### Scenario: menu saves session only
- **WHEN** the operator edits `spec-review.max-rounds` via the config menu
- **AND** chooses session-only save
- **THEN** the effective value uses source `session`
- **AND** the user preference store is unchanged for that key

#### Scenario: menu saves user default
- **WHEN** the operator edits `finish.return-to-main` to `required` via the config menu
- **AND** chooses user-default save
- **THEN** the user store contains `required` for that key
- **AND** with no session override the effective source is `user`

## MODIFIED Requirements

### Requirement: Pi ops-config command for session settings
The Pi extension surface SHALL provide an `ops-config` command (slash `/ops-config`) to show, get, set, unset, and reset openspec-ops settings for the **current Pi session**, and to manage optional **user-local** preferences for known keys.

Configuration MUST NOT require creating or editing a project config file in the repository.

Bare `/ops-config` with no arguments SHALL follow the admin menu contract (guided menu when UI is available; non-blocking text fallback otherwise). Explicit subcommands remain available.

#### Scenario: set and show session value
- **WHEN** the user runs ops-config to set `spec-review.max-rounds` to `5`
- **AND** then shows config
- **THEN** the effective value is 5 with source indicating session

#### Scenario: unset returns to user, env, or default
- **WHEN** a session override is unset
- **THEN** the effective value falls back to user preference (if set), else environment (if supported and set), else the documented default

#### Scenario: bare command does not require project file
- **WHEN** the operator uses `/ops-config` with or without arguments
- **THEN** no repository project config file is required or created for ops-config

### Requirement: Precedence session over env over default
Effective configuration SHALL resolve in order: **session override**, then **user-local preference**, then **environment fallback**, then **built-in default**.

Environment keys remain as documented (`OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS`, `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS`, `OPENSPEC_OPS_FINISH_RETURN_TO_MAIN`).

#### Scenario: session wins over env
- **WHEN** env would imply max-rounds 4
- **AND** session sets max-rounds to 2
- **THEN** effective max-rounds is 2

#### Scenario: session wins over user
- **WHEN** user preference would imply max-rounds 5
- **AND** session sets max-rounds to 2
- **THEN** effective max-rounds is 2 with source `session`

#### Scenario: user wins over env
- **WHEN** no session override exists
- **AND** user preference sets max-rounds to 5
- **AND** env would imply max-rounds 4
- **THEN** effective max-rounds is 5 with source `user`

#### Scenario: env wins over default when no session or user
- **WHEN** no session or user value exists for a key with env support
- **AND** a valid env value is set
- **THEN** effective resolution uses source `env`

### Requirement: Session-only persistence in v1
ops-config MUST document that **session** overrides are process-scoped and are not guaranteed to persist after the Pi process restarts, that **user** preferences persist under the Pi agent directory, and that ops-config MUST NOT use a repository project config file.

#### Scenario: docs state session vs user persistence
- **WHEN** reading ops-config help or README section
- **THEN** it states that session overrides reset when Pi restarts
- **AND** it states that user preferences persist in the agent-local store
- **AND** it states that settings are not project config files

#### Scenario: reset session leaves user intact
- **WHEN** the operator resets session overrides
- **AND** a user preference exists for a key
- **THEN** the effective value falls back to that user preference (or env/default if none)

### Requirement: impl-review max-rounds config key
ops-config SHALL support `impl-review.max-rounds` as a positive integer (clamped to a safe range such as 1–10), resolved with session > user > env `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS` > default 3.

#### Scenario: session override for impl-review
- **WHEN** session sets `impl-review.max-rounds` to `5`
- **THEN** effective impl-review max rounds is 5

#### Scenario: user preference for impl-review
- **WHEN** no session override exists
- **AND** user preference sets `impl-review.max-rounds` to `4`
- **THEN** effective impl-review max rounds is 4 with source `user`

### Requirement: Return-to-main policy config key
`ops-config` SHALL support `finish.return-to-main` with values `off` and `required`. Its effective value SHALL resolve with session override first, then user-local preference, then environment `OPENSPEC_OPS_FINISH_RETURN_TO_MAIN`, then default `off`.

The built-in default MUST remain `off` (non-mutating primary). User or session `required` affects Pi-injected effective policy for skills/deliver; it MUST NOT by itself change CLI `openspec-ops finish` flag defaults outside Pi policy injection.

#### Scenario: session enables strict closeout
- **WHEN** the operator runs `/ops-config set finish.return-to-main required`
- **THEN** the injected effective configuration reports `required` with source `session`

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
- **WHEN** an operator attempts to set `finish.return-to-main` to a value other than `off` or `required`
- **THEN** the command refuses to store the value

#### Scenario: default remains non-mutating
- **WHEN** neither session, user preference, nor environment configures the policy
- **THEN** the effective value is `off` with source `default`
