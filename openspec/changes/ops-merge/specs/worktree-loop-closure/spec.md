## ADDED Requirements

### Requirement: Documented loop includes ops-merge before archive
The recommended delivery loop documentation SHALL include **ops-merge** (or openspec-ops merge) after ops-impl-review (or ship when impl-review skipped) and before archive.

#### Scenario: README places merge before archive
- **WHEN** reading the recommended loop documentation after this change
- **THEN** merge appears after ship/impl-review and before archive
