## ADDED Requirements

### Requirement: ops-impl-review is the post-ship implementation quality gate
The project SHALL provide a Pi skill and slash entrypoint `ops-impl-review` / `/ops-impl-review` that reviews a named change’s **implementation** against OpenSpec specs and tasks after ship (commit + PR), before human merge.

The skill MUST NOT present itself as a substitute for human PR approval or merge authority.

#### Scenario: skill states post-ship purpose
- **WHEN** reading the ops-impl-review skill
- **THEN** it states it runs after ship and before merge and reviews implementation vs plan

---

### Requirement: Iterative review-fix-push loop until no major findings
When `/ops-impl-review` runs, the agent SHALL iteratively:

1. Review implementation using specs, tasks, and diff against the PR/base
2. Run project tests when a standard test command is available; treat failures as major
3. If major findings remain and rounds remain: edit implementation as needed, **push** to the change branch (no force), and re-review
4. Stop when no major findings or max rounds reached

Minor findings MUST NOT alone force another round.

#### Scenario: stops when majors cleared
- **WHEN** a review round finds zero major findings
- **THEN** the loop stops with a ready-for-human-merge style verdict

#### Scenario: test failure is major
- **WHEN** the project test command exits non-zero during a review round
- **THEN** that constitutes a major finding for the round

#### Scenario: push without force after fixes
- **WHEN** the agent applies code fixes during impl-review
- **THEN** updates are pushed without `--force` when publishing to the remote branch

#### Scenario: dirty worktree after fixes is committed then pushed
- **WHEN** impl-review fixes leave the worktree dirty
- **AND** a PR branch already exists for the change
- **THEN** the agent commits those fixes (or equivalent staged commit) before push
- **AND** does not open a second PR solely for those fixes

---

### Requirement: Default max rounds three and configurable without project config files
Default maximum rounds SHALL be **3**, overridable via ops-config key `impl-review.max-rounds` and env `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS`, with precedence session > env > default.

#### Scenario: default three
- **WHEN** no overrides are set
- **THEN** max rounds is 3

---

### Requirement: Worktree and PR-oriented context
ops-impl-review SHALL resolve the change worktree via openspec-ops where when available and SHALL use PR or base-branch diff context when a PR exists for the change branch.

#### Scenario: uses worktree path from where
- **WHEN** where succeeds for the change
- **THEN** implementation edits and tests use that worktree path
