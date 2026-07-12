## ADDED Requirements

### Requirement: ops-spec-review refuses archived changes without override
When `/ops-spec-review` is invoked for a change that is only present as an archived change (or active dir is absent and an archive directory for that change name exists), the review-fix loop MUST NOT run. The agent or tooling SHALL report a clear phase mismatch and stop, unless the user explicitly requests a historical re-review override.

#### Scenario: archived-only change skips fix rounds
- **WHEN** the change exists under `openspec/changes/archive/` for that name
- **AND** there is no active `openspec/changes/<name>/` on the resolved roots
- **AND** the user runs ops-spec-review without override
- **THEN** the skill does not perform multi-round artifact fix loops
- **AND** a phase mismatch / archived message is shown (e.g. phase_mismatch wording)

#### Scenario: explicit historical override allowed
- **WHEN** the user explicitly requests historical re-review / force
- **THEN** ops-spec-review MAY proceed despite archive signals

---

### Requirement: Doctor reports active and archived location mismatch
Doctor SHALL be able to report when an active change directory and an archive entry for the same change name both exist across primary and/or registered worktrees (split-brain), with a remediation hint that discourages re-running pre-apply spec-review.

#### Scenario: primary active and worktree archive
- **WHEN** primary has `openspec/changes/<name>/`
- **AND** a linked worktree has `openspec/changes/archive/*-<name>/` (or equivalent dated archive folder for that name)
- **THEN** doctor may emit a warning-class issue for location mismatch

---

### Requirement: Auto-review remains post-propose only
Automatic plan/spec review scheduling MUST remain tied to propose readiness and MUST NOT arm solely because archive or ship occurred.

#### Scenario: archive does not arm spec-review
- **WHEN** the user runs archive for a change
- **THEN** the system does not schedule ops-spec-review solely due to archive
