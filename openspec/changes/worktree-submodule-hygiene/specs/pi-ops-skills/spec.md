## ADDED Requirements

### Requirement: ops-start mentions submodule detached HEAD risk
Package-shipped ops-start skill/prompt SHALL instruct the agent that when the worktree contains git submodules, implementation inside those submodules MUST NOT remain long-lived on detached HEAD; the agent SHOULD create or switch to a named branch in the submodule before substantial edits, and commit in the submodule before updating the parent gitlink.

#### Scenario: ops-start skill mentions submodule branch
- **WHEN** reading the ops-start skill after this change
- **THEN** it mentions submodule detached HEAD risk or branching inside submodules when present
