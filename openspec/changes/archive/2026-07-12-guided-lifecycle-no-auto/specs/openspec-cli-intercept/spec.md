## REMOVED Requirements

### Requirement: Ensure worktree before new change when policy on
**Reason:** Intercept MUST NOT auto-ensure worktrees. Ensure/start is explicit only (`openspec-ops start`).

### Requirement: Prefer worktree cwd for upstream new change after ensure
**Reason:** No ensure step in intercept; cwd rewriting after ensure is removed.

### Requirement: Intercept policy env is on or off only
**Reason:** `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE` ensure policy is removed with ensure-on-new-change.

## MODIFIED Requirements

### Requirement: Pre-exec intercept of openspec new change
If an intercept shim remains packaged, it MUST forward `openspec new change` to the real OpenSpec binary without creating or requiring an openspec-ops worktree as a pre-step. Prefer documenting removal of ensure-on-intercept; operators use `/ops-start` before scaffolding when a worktree is desired.

#### Scenario: intercept does not ensure
- **WHEN** `openspec new change` is invoked through any remaining shim
- **THEN** the shim does not run `openspec-ops start` as a mandatory pre-step solely due to intercept policy

### Requirement: Documentation of shim install and non-modification of OpenSpec
Documentation SHALL state that worktree creation is via explicit `openspec-ops start`, not via intercept ensure, and that OpenSpec itself is still not forked.

#### Scenario: docs do not require intercept ensure
- **WHEN** reading intercept/alignment docs after this change
- **THEN** they do not describe ensure-before-new-change as required active behavior
