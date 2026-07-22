## ADDED Requirements

### Requirement: Deliver finish expects multi-head parent branch hygiene
The ops-deliver skill SHALL treat successful finish closeout as including parent branch hygiene for the change-default head when that head’s PR is merged (in addition to the located worktree head when different), subject to finish’s existing merged-PR gates and `--keep-branch`.

Deliver MUST NOT require a separate deprecated `prune` step solely to delete the change-named parent branch after an archive branch switch. Deliver MUST NOT claim that submodule feature remotes are deleted by default finish.

#### Scenario: deliver docs state finish covers change-default head
- **WHEN** reading ops-deliver instructions after this change
- **THEN** they state that finish attempts cleanup of the change-default parent branch as well as a different located head when present
- **AND** they do not instruct a mandatory post-finish `ops-prune` solely for the change-named parent branch under the happy path

#### Scenario: deliver does not promise submodule remote prune
- **WHEN** reading ops-deliver closeout guidance after this change
- **THEN** residual submodule feature branches/remotes are described as outside default finish deletion (diagnostics / separate opt-in)
