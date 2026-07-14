## MODIFIED Requirements

### Requirement: No automatic submodule branch or commit in this capability
This capability MUST NOT implement automatic `git switch -c` (or equivalent) inside submodules at **start** time without an explicit opt-in flag, and MUST NOT auto-commit in submodules or update parent gitlinks as part of doctor/where/**default** finish happy paths.

Opt-in finish primary closeout flags defined by `primary-closeout-sync` (`--sync-primary`, `--sync-submodules`, `--attach-submodule-main`) MAY mutate the **primary** checkout and its submodule work trees only when those flags are explicitly passed; they MUST remain default-off and MUST NOT auto-commit parent gitlink updates as a side effect of attach alone beyond documented switch/ff-to-pin behavior.

#### Scenario: start without submodule mutation flag
- **WHEN** `openspec-ops start` runs without a future opt-in submodule-branch flag
- **THEN** success does not require creating branches inside submodules

#### Scenario: default finish does not run primary submodule sync
- **WHEN** finish runs without primary closeout sync flags
- **THEN** finish does not require updating primary submodule checkouts or attaching them to `main`

---

## ADDED Requirements

### Requirement: Document detached-at-gitlink as normal after primary update
Project documentation for monorepo closeout SHALL state that after `git submodule update` on primary, a top-level submodule on **detached HEAD at the parent gitlink** is standard Git behavior (pin is source of truth), and MUST NOT describe that state alone as deliver or finish corruption.

#### Scenario: docs distinguish pin detach from broken HEAD
- **WHEN** reading submodule or deliver closeout documentation after this change
- **THEN** it states detached-at-gitlink on primary is expected after submodule update
- **AND** it does not instruct operators to treat clean pin detach as a failed deliver by itself

---

### Requirement: Doctor reports primary submodule pin hygiene
Doctor SHALL probe top-level submodules under the **primary** worktree (in addition to linked change worktrees) and report:

- `primary_submodule_detached` at **info** when a primary top-level submodule is detached and clean
- `primary_submodule_detached_dirty` at **warning** when a primary top-level submodule is detached and dirty

Probe MUST remain read-only and fail-open. Existing linked-worktree issue ids (`submodule_detached`, `submodule_detached_dirty`) remain for change worktrees.

#### Scenario: clean detached primary submodule is info
- **WHEN** doctor runs
- **AND** a top-level submodule under primary is detached and clean
- **THEN** an issue with id `primary_submodule_detached` and severity `info` is reported for that path

#### Scenario: dirty detached primary submodule is warning
- **WHEN** doctor runs
- **AND** a top-level submodule under primary is detached and dirty
- **THEN** an issue with id `primary_submodule_detached_dirty` and severity `warning` is reported

#### Scenario: primary probe failure is fail-open
- **WHEN** probing a primary submodule fails
- **THEN** doctor still completes for other checks
- **AND** does not fail solely due to that probe error
