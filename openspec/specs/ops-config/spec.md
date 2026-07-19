# ops-config Specification

## Purpose

Pi session configuration for openspec-ops via /ops-config (no project config files).
## Requirements
### Requirement: Pi ops-config command for session settings
The Pi extension surface SHALL provide an `ops-config` command (slash `/ops-config`) to show, get, set, unset, and reset openspec-ops settings for the **current Pi session**.

Configuration for v1 MUST NOT require creating or editing a project config file in the repository.

#### Scenario: set and show session value
- **WHEN** the user runs ops-config to set `spec-review.max-rounds` to `5`
- **AND** then shows config
- **THEN** the effective value is 5 with source indicating session

#### Scenario: unset returns to default or env
- **WHEN** a session override is unset
- **THEN** the effective value falls back to environment (if supported and set) or the documented default

---

### Requirement: Precedence session over env over default
Effective configuration SHALL resolve in order: session override, then environment fallback (`OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS` for max-rounds), then built-in default.

#### Scenario: session wins over env
- **WHEN** env would imply max-rounds 4
- **AND** session sets max-rounds to 2
- **THEN** effective max-rounds is 2

---

### Requirement: Known key for spec-review max rounds
ops-config SHALL support the key `spec-review.max-rounds` as a positive integer (implementation MAY clamp to a safe maximum such as 10).

#### Scenario: invalid value rejected or clamped
- **WHEN** the user sets `spec-review.max-rounds` to a non-positive or non-integer value
- **THEN** the command fails validation or refuses to store an unsafe value

---

### Requirement: Session-only persistence in v1
v1 ops-config MUST document that values are session-scoped and are not guaranteed to persist after the Pi process restarts.

#### Scenario: docs state non-persistent session store
- **WHEN** reading ops-config help or README section
- **THEN** it states that settings are session-scoped and not project config files

---

### Requirement: impl-review max-rounds config key
ops-config SHALL support `impl-review.max-rounds` as a positive integer (clamped to a safe range such as 1–10), resolved with session > env `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS` > default 3.

#### Scenario: session override for impl-review
- **WHEN** session sets `impl-review.max-rounds` to `5`
- **THEN** effective impl-review max rounds is 5

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
