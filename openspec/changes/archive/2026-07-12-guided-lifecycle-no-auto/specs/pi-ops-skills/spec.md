## ADDED Requirements

### Requirement: Lifecycle skills hand off to guided next-step
Lifecycle-oriented ops skills (including ship, merge, finish, and archive-adjacent handoff text where packaged) SHALL instruct the agent to offer guided next-step selection (`/ops-next` or equivalent) after success instead of automatically invoking the next lifecycle skill.

#### Scenario: ship skill does not mandate auto impl-review
- **WHEN** reading the ops-ship skill after this change
- **THEN** it does not require starting ops-impl-review solely because ship succeeded
- **AND** it points at guided next-step or explicit operator choice for follow-on work

### Requirement: No auto-ensure language in propose alignment skills
Packaged ops documentation/skills MUST NOT describe automatic worktree ensure on propose as active behavior.

#### Scenario: docs describe manual start
- **WHEN** reading ops lifecycle docs after this change
- **THEN** worktree creation is described as `/ops-start` / `openspec-ops start` before propose when a worktree is desired
