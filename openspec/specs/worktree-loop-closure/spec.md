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
When apply-intent is detected with a parseable kebab-case change name and worktree alignment is required (`openspec-ops` resolvable and a change worktree is in use or being established via **explicit** `openspec-ops start` / `/ops-start`—not via `OPENSPEC_OPS_AUTO_START`), the system SHALL resolve the workspace via where/start and provide an agent-visible **REQUIRED** constraint to use worktree path `W` for implementation and OpenSpec operations for that change.

The system MUST NOT claim process cwd was switched unless it was.
The system MUST NOT treat `OPENSPEC_OPS_AUTO_START` as a live policy switch.

#### Scenario: opsx-apply with name binds path when worktree available
- **WHEN** input begins with `/opsx-apply add-dark-mode`
- **AND** alignment is required under the explicit-start model
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
After archive, reclaiming a worktree via finish SHALL remain non-committing and MUST NOT auto-pass `--force` for dirty trees. Finish is invoked explicitly by the operator (or via guided next-step choice), not by retired auto-finish policy.

Dirty worktrees still require explicit `--force` consent; the system MUST NOT describe this as “auto-finish skipped” as if auto-finish were still the default path.

#### Scenario: dirty worktree requires explicit force for finish
- **WHEN** a change worktree is dirty after archive
- **AND** finish is run without `--force`
- **THEN** finish fails without removing the worktree
- **AND** messaging does not depend on auto-finish policy env

#### Scenario: finish is not auto-chained from archive
- **WHEN** archive completes
- **THEN** finish is not required to run automatically
- **AND** operators use `/ops-finish` or `/ops-next` to reclaim the worktree


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

---

### Requirement: Documented loop includes ship before merge
The recommended delivery loop documentation SHALL include an explicit **ship** (commit + push + PR) step after apply and before merge/archive/finish.

#### Scenario: README mentions ship before merge
- **WHEN** reading the recommended loop documentation after this change
- **THEN** ship or commit/PR via openspec-ops ship appears after apply and before merge


---

### Requirement: Documented loop includes optional prune after finish
The recommended delivery loop documentation SHALL include an optional **prune** step after finish (and after PR merge) to delete local and remote change branches when the PR is merged.

#### Scenario: README mentions prune after merge and finish
- **WHEN** reading the recommended loop documentation after this change
- **THEN** prune appears after merge/finish (not before merge)
- **AND** finish is not described as deleting the branch by default


---

### Requirement: Documented loop includes ops-spec-review between propose and apply
The recommended delivery loop documentation SHALL include **ops-spec-review** (iterative plan/spec review-fix) after propose and before apply.

#### Scenario: README places spec review before apply
- **WHEN** reading the recommended loop documentation after this change
- **THEN** ops-spec-review or /ops-spec-review appears after propose and before apply

---

### Requirement: Documented loop includes ops-impl-review after ship
The recommended delivery loop documentation SHALL include **ops-impl-review** after ship and before merge.

#### Scenario: README places impl-review after ship
- **WHEN** reading the recommended loop documentation after this change
- **THEN** ops-impl-review appears after ship and before merge

---

### Requirement: Documented loop includes ops-merge before archive
The recommended delivery loop documentation SHALL include **ops-merge** (or openspec-ops merge) after ops-impl-review (or ship when impl-review skipped) and before archive.

#### Scenario: README places merge before archive
- **WHEN** reading the recommended loop documentation after this change
- **THEN** merge appears after ship/impl-review and before archive

---

### Requirement: Docs warn about worktree archive vs primary residual
Recommended loop documentation SHALL state that default archive is on mainline after merge, and that archiving only on a worktree while leaving an active change directory on primary confuses status and may trigger wrong-phase spec-review.

#### Scenario: README mentions residual active footgun
- **WHEN** reading loop/archive documentation after this change
- **THEN** it mentions mainline archive preference or primary residual risk

### Requirement: Documented loop ends with finish without required prune
The recommended delivery loop documentation SHALL present closeout as **archive → finish**, without requiring a separate prune step. Finish is described as reclaiming the worktree and, when appropriate, merged branches.

#### Scenario: README omits required prune after finish
- **WHEN** reading the recommended loop after this change
- **THEN** prune is not required after finish for the default happy path
- **AND** finish is described as the closeout command after archive

### Requirement: Documented loop is explicit stations with operator choice
The recommended delivery loop documentation SHALL present lifecycle as explicit operator-driven stations (start → propose → optional spec-review → apply → ship → optional impl-review → merge → archive → finish) with next-step selection between stations, not as an automatic pipeline of ensure/review/finish.

#### Scenario: README does not advertise auto-review default on
- **WHEN** reading the recommended loop after this change
- **THEN** it does not describe OPENSPEC_OPS_AUTO_REVIEW default-on follow-up as active behavior
- **AND** it describes choosing next steps (guided next-step or manual slashes)

### Requirement: Closeout remains archive then finish without required prune
The documented default closeout SHALL remain archive then finish without requiring prune, consistent with finish closeout absorbing merged branch cleanup.

#### Scenario: prune not required after finish
- **WHEN** reading the recommended closeout after this change
- **THEN** prune is not a required step on the happy path

### Requirement: No live AUTO_* env in loop documentation
Recommended loop documentation and loop-closure requirements MUST NOT present `OPENSPEC_OPS_AUTO_START`, `OPENSPEC_OPS_AUTO_REVIEW`, `OPENSPEC_OPS_AUTO_FINISH`, or `OPENSPEC_OPS_AUTO_IMPL_REVIEW` as active configuration for the default product.

#### Scenario: loop docs omit live AUTO env tables
- **WHEN** reading the recommended delivery loop after this change
- **THEN** it does not instruct operators to set OPENSPEC_OPS_AUTO_* to control ensure/review/finish/impl-review auto behavior

### Requirement: Optional deliver path still ends merge then archive then finish
When operators use ops-deliver, the documented and implemented default SHALL place **merge before archive** and **finish after archive**, consistent with the recommended loop.

#### Scenario: deliver does not archive before merge
- **WHEN** deliver runs the default pipeline
- **THEN** it does not archive the OpenSpec change before merge has succeeded or the PR is already merged
