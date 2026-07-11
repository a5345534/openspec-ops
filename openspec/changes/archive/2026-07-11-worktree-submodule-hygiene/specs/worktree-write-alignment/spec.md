## ADDED Requirements

### Requirement: Path alignment does not create submodule branches
Worktree write alignment (ensure, REQUIRED path inject, snippets) SHALL document that directing writes into the worktree path does **not** create feature branches inside git submodules, and that agents remain responsible for submodule branch/commit hygiene when `.gitmodules` is present.

#### Scenario: snippet or docs mention submodule identity gap
- **WHEN** reading worktree alignment documentation after this change
- **THEN** it states that path alignment alone does not put submodules on a change branch
