## ADDED Requirements

### Requirement: Phase check before review-fix loop
ops-spec-review SHALL perform a lifecycle phase check before entering the iterative major-fix loop, and MUST skip the loop when the change is in an archived (or equivalent post-plan) phase without an explicit override.

#### Scenario: skill documents pre-apply phase and refuse behavior
- **WHEN** reading the ops-spec-review skill after this change
- **THEN** it states pre-apply timing and that archived/wrong-phase invocations should stop with a clear message
