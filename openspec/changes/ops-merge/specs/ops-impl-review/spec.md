## ADDED Requirements

### Requirement: Impl-review remains non-merging
ops-impl-review MUST NOT merge the pull request; merging remains the responsibility of the explicit merge command when the operator requests it.

#### Scenario: impl-review does not merge
- **WHEN** ops-impl-review completes a review-fix-push loop
- **THEN** it does not merge the PR into the base branch as part of that skill
