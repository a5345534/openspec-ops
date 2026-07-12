## ADDED Requirements

### Requirement: Documented loop includes optional prune after finish
The recommended delivery loop documentation SHALL include an optional **prune** step after finish (and after PR merge) to delete local and remote change branches when the PR is merged.

#### Scenario: README mentions prune after merge and finish
- **WHEN** reading the recommended loop documentation after this change
- **THEN** prune appears after merge/finish (not before merge)
- **AND** finish is not described as deleting the branch by default
