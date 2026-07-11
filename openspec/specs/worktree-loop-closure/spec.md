# worktree-loop-closure Specification

## Purpose

Close the openspec-ops worktree loop: apply path binding, archive decision tree, finish policy messaging, doctor hygiene, and documented default order **merge → archive → finish** (without ship/merge automation in this capability).

## Requirements

### Requirement: Documented default loop is merge then archive then finish
The system SHALL document the recommended end-to-end order as:

ensure/start → propose (worktree writes) → optional plan review → apply (worktree) → commit/PR (external or future ops-ship) → code review → **merge into main** → **archive** → **finish**.

The default documented order MUST place **merge before archive**. Archive-before-merge MUST NOT be presented as the default.

#### Scenario: README states merge before archive
- **WHEN** reading the recommended loop documentation after this change
- **THEN** merge appears before archive in the default sequence
- **AND** finish appears after archive

---

### Requirement: Apply path binding to worktree when change name known
When apply-intent is detected with a parseable kebab-case change name and worktree alignment is required (openspec-ops resolvable and `OPENSPEC_OPS_AUTO_START` not `off`), the system SHALL resolve the workspace via where/start and provide an agent-visible **REQUIRED** constraint to use worktree path `W` for implementation and OpenSpec operations for that change.

The system MUST NOT claim process cwd was switched unless it was.

#### Scenario: opsx-apply with name ensures and injects path
- **WHEN** input begins with `/opsx-apply add-dark-mode`
- **AND** alignment is required
- **AND** where/start succeeds with path `W`
- **THEN** the agent receives a REQUIRED write/implement path constraint naming `W`
- **AND** stock apply is allowed to continue

#### Scenario: apply without name does not false-ensure
- **WHEN** input is `/opsx-apply` with no parseable change name
- **THEN** the system does not report a successful ensure for a concrete change
- **AND** may notify that worktree binding waits for a change name

---

### Requirement: Archive path uses a documented decision tree
The system SHALL document and, where a harness handoff exists, follow this decision tree:

1. If `where C` succeeds and the active change directory path is under worktree `W` (typical pre-merge): prefer archive-related operations with cwd `W` (or equivalent).
2. If following the **default** post-merge loop: archive on the **mainline checkout** that holds main `openspec/specs` (often primary); the system MUST NOT require the worktree and MUST NOT fail or block archive solely because a worktree for `C` still exists.
3. Archive-before-merge is non-default and is not automated by this capability.

#### Scenario: docs describe merge then archive on mainline
- **WHEN** reading loop documentation
- **THEN** it states the default is merge first, then archive on the mainline checkout, then finish the worktree

#### Scenario: handoff does not block primary archive after merge
- **WHEN** a worktree for change `C` still exists
- **AND** the operator runs archive on the primary/mainline checkout per default loop
- **THEN** the harness MUST NOT abort archive solely due to the worktree’s existence

#### Scenario: pre-merge change under W prefers W
- **WHEN** `where C` reports changeDir under worktree path `W`
- **AND** a harness archive handoff runs for `C`
- **THEN** the handoff prefers `W` for archive-related work without reimplementing OpenSpec archive

---

### Requirement: Post-archive finish never commits and never force-cleans dirty trees automatically
After archive-related settle evaluation, automatic finish MUST NOT run `git commit`, `git merge`, or `git push`.

When the worktree is dirty, automatic finish MUST NOT pass `--force`; it MUST surface a message that cleanup was skipped and that the operator may commit/ship or explicitly consent to force-finish.

#### Scenario: dirty worktree skips auto-finish without force
- **WHEN** post-archive finish evaluation finds a dirty worktree
- **THEN** `openspec-ops finish` is not invoked with `--force` automatically
- **AND** the user is informed that auto-finish was skipped

#### Scenario: finish gate does not ship
- **WHEN** auto-finish runs or skips
- **THEN** it does not create a git commit or merge into main as part of that gate

---

### Requirement: Doctor surfaces loop hygiene issues
Doctor SHOULD report actionable issues that break the worktree loop, including when feasible:

- openspec-ops binary missing
- openspec not intercept when intercept is the intended ensure-before-scaffold path
- dirty registered worktree with no active change directory (leftover after archive)
- optional: change artifacts only on primary while a worktree is registered

#### Scenario: doctor can report leftover dirty worktree class
- **WHEN** doctor runs and a registered worktree is dirty and the inferred change is no longer active
- **THEN** an issue of info or warning severity may be reported to guide finish or ship

---

### Requirement: Ship automation is out of this capability
This capability MUST NOT implement automated `git commit`, `git push`, pull request creation, or merge into main.

#### Scenario: no ship subcommand required here
- **WHEN** this capability is implemented
- **THEN** success does not require an `openspec-ops ship` command to exist
