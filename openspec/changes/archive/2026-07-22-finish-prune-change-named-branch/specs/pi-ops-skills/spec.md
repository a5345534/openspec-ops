## MODIFIED Requirements

### Requirement: ops-finish documents merged branch cleanup
The ops-finish skill/prompt SHALL describe that finish removes the worktree when present and, when merged PRs are verified, deletes local and remote **parent** branches for the change-default head and the resolved located head (when different), unless `--keep-branch` is used. It SHALL state that each head is gated independently by merged-PR verification and that unmerged heads are kept without force-delete.

#### Scenario: ops-finish mentions branch cleanup
- **WHEN** reading ops-finish after this change
- **THEN** it mentions merged PR branch deletion or keep-branch

#### Scenario: ops-finish mentions multi-head parent cleanup
- **WHEN** reading ops-finish after this change
- **THEN** it states that both the change-default branch and a different worktree/located branch are cleanup candidates when they differ
- **AND** it does not claim default finish deletes submodule feature branches

## ADDED Requirements

### Requirement: ops-deliver and ops-finish document archive-on-change-branch preference
The ops-deliver and ops-finish skills/prompts SHALL state that OpenSpec archive is an artifact move and SHOULD be performed while the change worktree remains on the change-default branch when practical. They SHALL warn that switching the worktree solely to a new `archive-*` (or other) git branch for a follow-up PR changes the located finish head, and that finish multi-head cleanup still targets the change-default branch separately when its PR is merged.

#### Scenario: deliver mentions prefer archive on change branch
- **WHEN** reading ops-deliver after this change
- **THEN** it prefers archiving without abandoning the change-default git branch as the only head
- **AND** it notes finish will still attempt change-default parent prune when that PR is merged

#### Scenario: finish skill mentions leftover change-named branch hygiene
- **WHEN** reading ops-finish after this change
- **THEN** it describes residual change-named parent branches after archive branch switch as a hygiene case finish multi-head cleanup addresses
