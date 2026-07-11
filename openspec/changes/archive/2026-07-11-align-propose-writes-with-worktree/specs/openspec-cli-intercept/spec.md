## ADDED Requirements

### Requirement: Operators can verify intercept is active
Documentation and doctor (or equivalent read-only diagnostics) SHALL help operators determine whether invocations of `openspec` will hit `openspec-ops-intercept` when that is the intended configuration.

Diagnostics SHOULD report whether `openspec-ops` is resolvable and MAY warn when `openspec` on PATH does not appear to be the intercept entrypoint while intercept is recommended for ensure-before-scaffold.

#### Scenario: doctor or docs cover PATH verification
- **WHEN** an operator follows project guidance to enable ensure-before-scaffold via intercept
- **THEN** they have a documented way to verify intercept vs stock OpenSpec on PATH
