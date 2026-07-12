# openspec-cli-intercept Specification

## Purpose

Optional shim around stock OpenSpec CLI. Worktree ensure-before-new-change is retired; any remaining shim is forward-only.

## Requirements

### Requirement: Pre-exec intercept of openspec new change
If an intercept shim remains packaged, it MUST forward `openspec new change` to the real OpenSpec binary without creating or requiring an openspec-ops worktree as a pre-step. Operators use `/ops-start` before scaffolding when a worktree is desired.

#### Scenario: intercept does not ensure
- **WHEN** `openspec new change` is invoked through any remaining shim
- **THEN** the shim does not run `openspec-ops start` as a mandatory pre-step solely due to intercept policy

### Requirement: Resolve real OpenSpec binary without recursion
The intercept MUST resolve the real OpenSpec binary without invoking itself recursively (e.g. via `OPENSPEC_REAL_BIN` or PATH filtering).

#### Scenario: real bin resolved
- **WHEN** intercept runs with a configured real OpenSpec binary
- **THEN** it forwards to that binary without infinite recursion

### Requirement: Change name parsing
The intercept MAY parse change names for diagnostics but MUST NOT require ensure success to forward.

#### Scenario: invalid name still may forward or fail as OpenSpec decides
- **WHEN** `openspec new change` is invoked with an invalid name
- **THEN** intercept does not create a worktree as a side effect of parsing failure

### Requirement: Documentation of shim install and non-modification of OpenSpec
Documentation SHALL state that worktree creation is via explicit `openspec-ops start`, not via intercept ensure, and that OpenSpec itself is still not forked.

#### Scenario: docs do not require intercept ensure
- **WHEN** reading intercept/alignment docs after this change
- **THEN** they do not describe ensure-before-new-change as required active behavior

### Requirement: Operators can verify intercept is active
Doctor or docs MAY help operators verify whether PATH `openspec` points at the intercept shim when they intentionally use it for non-ensure reasons.

#### Scenario: verification guidance exists
- **WHEN** operators consult doctor/docs about intercept
- **THEN** guidance exists to identify the shim vs stock openspec
