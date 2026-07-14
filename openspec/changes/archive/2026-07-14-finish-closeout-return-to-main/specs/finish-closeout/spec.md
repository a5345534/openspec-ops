## ADDED Requirements

### Requirement: Finish documents success boundary versus primary update
Project documentation for finish and deliver/closeout SHALL state that a successful finish (and a successful merge on the remote) does **not** by itself update the operator’s primary worktree to match `origin/<base>`, and SHALL point operators at a recommended monorepo checklist: checkout base on primary, `git pull --ff-only`, then `git submodule update --init` (recursive as needed), expecting submodules detached at gitlink unless an attach policy is used.

#### Scenario: README or finish help states primary not auto-pulled
- **WHEN** reading finish or deliver closeout documentation after this change
- **THEN** it states that GitHub/mainline success does not imply the primary checkout was pulled
- **AND** it documents recommended pull and submodule update steps for monorepos

---

### Requirement: Finish accepts opt-in primary closeout sync flags
`openspec-ops finish` SHALL accept documented opt-in flags for primary closeout sync (`--sync-primary`, `--sync-submodules`, and `--attach-submodule-main`, all default off) whose behavior is defined by the `primary-closeout-sync` capability. Without those flags, finish behavior for worktree removal and merged parent branch cleanup remains unchanged.

#### Scenario: flags default off
- **WHEN** finish is invoked without sync flags
- **THEN** no primary pull or primary submodule update is required for success
- **AND** worktree removal and merged-branch cleanup still apply as specified elsewhere

#### Scenario: help lists sync flags as optional
- **WHEN** a user inspects finish CLI help after this change
- **THEN** `--sync-primary`, `--sync-submodules`, and `--attach-submodule-main` (or documented equivalents) appear as optional flags
