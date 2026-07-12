## ADDED Requirements

### Requirement: ops-finish skill and prompt match finish closeout
The ops-finish skill and prompt SHALL describe that finish may delete local and remote branches when a merged PR is verified (unless `--keep-branch`), and MUST NOT claim that successful finish always keeps the branch with `branchDeleted: false`.

#### Scenario: finish prompt does not always claim branch kept
- **WHEN** reading the ops-finish prompt after this change
- **THEN** it does not instruct agents that exit 0 always means branch kept / `branchDeleted: false` without mentioning merged cleanup
