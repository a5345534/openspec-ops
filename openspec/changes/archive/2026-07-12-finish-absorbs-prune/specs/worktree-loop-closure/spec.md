## ADDED Requirements

### Requirement: Documented loop ends with finish without required prune
The recommended delivery loop documentation SHALL present closeout as **archive → finish**, without requiring a separate prune step. Finish is described as reclaiming the worktree and, when appropriate, merged branches.

#### Scenario: README omits required prune after finish
- **WHEN** reading the recommended loop after this change
- **THEN** prune is not required after finish for the default happy path
- **AND** finish is described as the closeout command after archive
