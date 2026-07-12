## ADDED Requirements

### Requirement: Prune is deprecated in favor of finish
The product SHALL treat `openspec-ops prune` as deprecated for primary closeout. Documentation and the ops-prune skill SHALL direct operators to `openspec-ops finish` for worktree removal and merged branch cleanup.

Prune MAY remain as a thin compatibility entry that performs branch-only cleanup under the same merged-PR rules, without remaining the recommended default path.

#### Scenario: docs prefer finish over prune
- **WHEN** reading recommended loop documentation after this change
- **THEN** the default closeout after archive is finish without requiring a separate prune step

#### Scenario: prune skill mentions deprecation
- **WHEN** reading the ops-prune skill after this change
- **THEN** it states finish is preferred for closeout
