## MODIFIED Requirements

### Requirement: Package propose orchestration resolves workspace before writes
Worktree alignment for propose MUST NOT require the openspec-ops Pi package to export a skill named `openspec-propose` or a prompt named `opsx-propose`.

Valid mechanisms: extension constraints, opt-in intercept, doctor diagnostics, and a **documentation snippet** for consumers to merge into **their own** propose skill after `openspec update`.

This version does not require shipping an `ops-propose` package skill; if a future orchestrator is added, it MUST use an **ops-*** name and MUST NOT be named `openspec-propose`.

#### Scenario: package does not require openspec-propose export for alignment
- **WHEN** implementing worktree write alignment for package consumers
- **THEN** success criteria do not depend on `pi.skills` including `openspec-propose`

#### Scenario: snippet is an allowed alignment mechanism
- **WHEN** documenting consumer alignment without package openspec-propose
- **THEN** a paste-in snippet path (e.g. under `docs/snippets/`) is an accepted mechanism
