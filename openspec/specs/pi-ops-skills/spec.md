# pi-ops-skills Specification

## Purpose

Pi agent skills and slash prompts that orchestrate the openspec-ops workspace CLI with stable JSON handling and OpenSpec boundary guardrails.

## Requirements

### Requirement: Four paired Pi skills and slash prompts exist
The project SHALL provide Pi skills and matching slash prompts for workspace lifecycle orchestration under the **ops-** prefix only for package export:

| Skill directory | Prompt file | CLI command |
|---|---|---|
| `.pi/skills/ops-start/` | `.pi/prompts/ops-start.md` | `openspec-ops start` |
| `.pi/skills/ops-where/` | `.pi/prompts/ops-where.md` | `openspec-ops where` |
| `.pi/skills/ops-finish/` | `.pi/prompts/ops-finish.md` | `openspec-ops finish` |
| `.pi/skills/ops-doctor/` | `.pi/prompts/ops-doctor.md` | `openspec-ops doctor` |

Additional package-exported skills (e.g. `ops-spec-review`) MUST also use the `ops-` prefix.

The Pi package export surface MUST NOT include skills named `openspec-*` or prompts named `opsx-*`.

#### Scenario: Skill layout present for ops lifecycle
- **WHEN** the change is implemented
- **THEN** the four lifecycle skill directories and prompt files listed above exist for product use

#### Scenario: Package export excludes openspec and opsx names
- **WHEN** inspecting package.json `pi.skills` and `pi.prompts`
- **THEN** exported paths do not load `openspec-*` skills or `opsx-*` prompts

### Requirement: Full-text self-contained documents
Each skill `SKILL.md` and each prompt `ops-*.md` MUST be operationally self-contained.

A document is operationally self-contained when an agent following only that file can:

1. Resolve the `openspec-ops` binary
2. Invoke the correct subcommand with `--json`
3. Branch on exit codes and `error.code`
4. Apply command-specific confirmations/guardrails

Prompts MUST NOT reduce to a pointer such as “follow the skill file” without embedding the same runtime rules and steps.

Skills MUST NOT require reading README or another skill file to perform the happy path.

When shared rules or command steps change, all eight documents MUST be updated in the same change so capability stays equivalent between skill and prompt pairs.

#### Scenario: Prompt includes shared runtime rules
- **WHEN** reading `.pi/prompts/ops-start.md`
- **THEN** the file contains binary resolution, `--json` requirement, exit code handling, and hard guardrails in-line

#### Scenario: Skill includes shared runtime rules
- **WHEN** reading `.pi/skills/ops-start/SKILL.md`
- **THEN** the file contains the same classes of runtime rules as the matching prompt (binary resolution, JSON, exits, guardrails)

---

### Requirement: Shared runtime rules content
Every ops skill and ops prompt SHALL instruct the agent to:

1. Resolve binary in order: `$OPENSPEC_OPS_BIN` if set → `openspec-ops` on `PATH` → stop with install/link guidance
2. Always pass `--json` on CLI invocations
3. Parse a single JSON object from stdout and require `schemaVersion` equal to `1` (warn or stop on mismatch)
4. Use exit codes `0|1|2|3|4|5|10` with the Phase 0 meanings (success; usage/invalid name; repo/base errors; conflicts; dirty; not found; git/internal)
5. Prefer `error.code` over scraping `error.message` for control flow
6. Never run raw `git worktree` / `git switch` as a substitute for the CLI
7. Never replace or silently implement `/opsx-propose`, `/opsx-apply`, `/opsx-archive`, or `/opsx-sync`
8. Never commit, push, open PRs, merge, or delete branches as part of these skills
9. Never pass `--force` without explicit user consent in the current turn
10. Prefer subsequent implementation/OpenSpec commands use the workspace `path` as cwd when known

#### Scenario: Missing binary stops without git fallback
- **WHEN** the agent follows an ops skill and `openspec-ops` cannot be resolved
- **THEN** the instructions require stopping with install guidance
- **AND** the instructions forbid falling back to manual `git worktree add`

#### Scenario: JSON schema version pinned
- **WHEN** the agent runs an ops CLI command per the skill
- **THEN** the instructions require `--json` and `schemaVersion === 1` handling

---

### Requirement: ops-start orchestration behavior
The ops-start skill and prompt SHALL instruct the agent to:

- Accept a kebab-case change name or derive one from a description and confirm before running the CLI
- Run `openspec-ops start <change> [user-requested flags only] --json`
- Treat both `result.action=created` and `result.action=reused` as success
- Surface conflicts (`branch_busy`, `path_not_worktree`, `path_occupied`, `branch_mismatch`, etc.) without destructive auto-repair
- Report `path`, `branch`, `action`, and `changeDirExists`
- If the user only requested workspace setup: stop after success reporting
- If the user requested beginning a full change: allow continuing to OpenSpec propose as a **separate** step using `result.path` as cwd
- State that missing `openspec/changes/<change>` before propose is normal

#### Scenario: Start success reports path
- **WHEN** start succeeds per the skill instructions
- **THEN** the agent is directed to report the workspace path and branch to the user

#### Scenario: Start does not imply propose completed
- **WHEN** ops-start finishes successfully
- **THEN** the instructions MUST NOT claim OpenSpec proposal artifacts were created by ops-start alone

---

### Requirement: ops-where orchestration behavior
The ops-where skill and prompt SHALL instruct the agent to:

- Require a change name (do not guess among multiple changes)
- Run `openspec-ops where <change> --json` as a read-only operation
- On `not_found` (exit 5), suggest ops-start / `/ops-start` and MUST NOT auto-run start unless the user asked to create the workspace
- On success, report path, branch, dirty, and match basis

#### Scenario: Where not found suggests start
- **WHEN** where returns not_found per the skill
- **THEN** the agent is directed to suggest creating a workspace with ops-start

#### Scenario: Where does not finish or start as side effect
- **WHEN** the user only asks where a workspace is
- **THEN** the instructions limit the CLI side effects to `where` only

---

### Requirement: ops-finish orchestration behavior
The ops-finish skill and prompt SHALL instruct the agent to:

- Target worktree removal only (branch kept; not OpenSpec archive)
- Recommend preflight `openspec-ops where <change> --json` when helpful
- Soft-warn when dirty; require explicit consent before `--force`
- Soft-warn when a change directory still appears present that finish does not archive
- Run `openspec-ops finish <change> [--force] --json` only after needed confirmations
- On success, state that the branch was kept and OpenSpec was not archived

#### Scenario: Dirty finish requires consent for force
- **WHEN** the worktree is dirty and the user has not consented to force removal
- **THEN** the instructions require asking the user before passing `--force`

#### Scenario: Finish is not archive
- **WHEN** finish succeeds
- **THEN** the instructions require communicating that OpenSpec archive was not performed

---

### Requirement: ops-doctor orchestration behavior
The ops-doctor skill and prompt SHALL instruct the agent to:

- Run `openspec-ops doctor [--repo] --json`
- Treat exit 0 with warnings/issues as a normal completed check
- Present primaryPath/worktreeRoot, summary counts, issues, and worktree inventory
- MUST NOT automatically delete directories, prune worktrees, or run finish without user request
- Direct change-specific cleanup toward ops-finish rather than ad-hoc `rm`

#### Scenario: Doctor does not auto-fix
- **WHEN** doctor reports `stale_worktree_dir` or other issues
- **THEN** the instructions require reporting and optional manual suggestions only, without automatic destructive cleanup

---

### Requirement: OpenSpec boundary
ops-* skills and prompts MUST remain a side path around OpenSpec:

- They MUST NOT rename or shadow `/opsx-propose`, `/opsx-apply`, `/opsx-archive`, or `/opsx-sync`
- They MUST NOT invoke the OpenSpec CLI as a required step of start/where/finish/doctor success paths
- finish MUST be described as workspace cleanup, not spec archival

#### Scenario: No opsx command replacement
- **WHEN** comparing new prompt filenames to existing OpenSpec prompts
- **THEN** new prompts use `ops-*.md` and existing `opsx-*.md` files remain the OpenSpec entrypoints

---

### Requirement: README documents Pi usage
The root `README.md` SHALL document:

- The mapping ` /ops-start` → OpenSpec `/opsx-*` → `/ops-finish`
- That skills shell out to `openspec-ops` and require the CLI on `PATH` or `OPENSPEC_OPS_BIN`
- Non-goals: no auto-hijack of OpenSpec commands; prompts/skills are full-text maintained in pairs

#### Scenario: README mentions ops-start and ops-finish
- **WHEN** reading the root README after the change
- **THEN** it describes using ops-start before OpenSpec work and ops-finish for worktree cleanup

---

### Requirement: Propose orchestration binds OpenSpec writes to workspace path
Package-shipped propose-related skills and prompts SHALL, once a change name is known, resolve `openspec-ops where`/`start` and use `result.path` as cwd for OpenSpec CLI and `openspec/changes/<change>/` writes, following worktree-write-alignment fail-closed rules.

Ops-specific steps SHALL be enclosed in:

`<!-- openspec-ops:worktree-alignment BEGIN -->` … `<!-- openspec-ops:worktree-alignment END -->`

so operators can detect loss after `openspec update`.

#### Scenario: propose skill mentions where then cwd
- **WHEN** reading the package propose skill or matching prompt
- **THEN** it includes steps to resolve the workspace path and perform scaffold/writes there

#### Scenario: propose skill has durable marker block
- **WHEN** reading the package propose skill after this change
- **THEN** the worktree-alignment BEGIN/END markers are present

### Requirement: Apply orchestration prefers workspace path when known
Package-shipped apply-related skills and prompts SHOULD instruct the agent to prefer the openspec-ops worktree path as cwd when implementing a named change that has a registered workspace.

#### Scenario: apply skill mentions worktree path when available
- **WHEN** reading the package apply skill
- **THEN** it mentions using the change worktree path from openspec-ops when known

### Requirement: Apply skill prefers openspec-ops worktree path
Package-shipped apply-related skills and prompts (ops-* surface only) SHALL instruct the agent, once a change name is known, to resolve `openspec-ops where`/`start` when available and prefer `result.path` as cwd for implementation writes for that change.

#### Scenario: apply skill mentions where path
- **WHEN** reading the package apply skill or matching ops-aligned apply prompt section
- **THEN** it mentions using the openspec-ops worktree path when known

Note: Package export remains ops-* only; this does not reintroduce `openspec-*` / `opsx-*` package skills.

### Requirement: ops-start mentions submodule detached HEAD risk
Package-shipped ops-start skill/prompt SHALL instruct the agent that when the worktree contains git submodules, implementation inside those submodules MUST NOT remain long-lived on detached HEAD; the agent SHOULD create or switch to a named branch in the submodule before substantial edits, and commit in the submodule before updating the parent gitlink.

#### Scenario: ops-start skill mentions submodule branch
- **WHEN** reading the ops-start skill after this change
- **THEN** it mentions submodule detached HEAD risk or branching inside submodules when present

---

### Requirement: ops-ship skill and prompt exist
The project SHALL provide a Pi skill and matching slash prompt for shipping a change worktree (`ops-ship`), under the ops-* package export surface only.

The skill/prompt SHALL instruct the agent to:
- Resolve `openspec-ops` binary
- Run `openspec-ops ship <change> ... --json`
- Handle JSON/exit codes
- Not merge the PR
- Not use finish as a substitute for ship
- Prefer explicit user consent before ship when changes are large or unexpected

#### Scenario: ops-ship skill documents ship command
- **WHEN** reading the ops-ship skill
- **THEN** it includes an `openspec-ops ship` invocation with `--json`


---

### Requirement: ops-prune skill and prompt exist
The project SHALL provide a Pi skill and matching prompt for `ops-prune` that instruct the agent to run `openspec-ops prune <change> --json`, only after merge and after worktree finish, and never to force-delete unmerged branches or bulk-delete unrelated branches.

#### Scenario: ops-prune skill documents prune command
- **WHEN** reading the ops-prune skill
- **THEN** it includes `openspec-ops prune` with `--json` and merged-PR gating guidance


---

### Requirement: ops-spec-review skill and prompt are shipped
Package-exported Pi skills/prompts SHALL include `ops-spec-review` describing the iterative plan/spec review-fix loop and worktree-aligned change resolution.

#### Scenario: ops-spec-review skill present
- **WHEN** inspecting package ops-* skills after this change
- **THEN** an ops-spec-review skill exists and mentions major/minor findings and max rounds

### Requirement: ops-review skill and prompt are removed
The package MUST NOT ship `ops-review` skill or `ops-review` prompt after this change; plan/spec review is only via `ops-spec-review`.

#### Scenario: ops-review paths absent from package surface
- **WHEN** inspecting package-exported ops skills/prompts after this change
- **THEN** there is no ops-review skill directory or ops-review prompt file

#### Scenario: README names ops-spec-review as the gate
- **WHEN** reading README loop documentation after this change
- **THEN** the propose→apply quality gate is named ops-spec-review (or /ops-spec-review)

---

### Requirement: ops-impl-review skill and prompt exist
Package-exported ops skills/prompts SHALL include `ops-impl-review` describing the post-ship iterative implementation review-fix-push loop, test expectations, and max-rounds config.

#### Scenario: ops-impl-review skill present
- **WHEN** inspecting ops-* skills after this change
- **THEN** ops-impl-review exists and mentions ship-after timing and tests

### Requirement: ops-ship skill points to impl-review when auto on
The ops-ship skill/prompt SHALL instruct that after successful ship, when auto impl-review policy is on (default), the agent continues with `/ops-impl-review <change>`.

#### Scenario: ops-ship mentions impl-review follow-through
- **WHEN** reading the ops-ship skill after this change
- **THEN** it mentions ops-impl-review or AUTO_IMPL_REVIEW after success

---

### Requirement: ops-merge skill and prompt exist
Package-exported ops skills/prompts SHALL include `ops-merge` that instructs the agent to run `openspec-ops merge <change> --json` only when the user explicitly requested merging, and that ship/impl-review paths must not call merge without that request.

#### Scenario: ops-merge skill documents merge CLI
- **WHEN** reading the ops-merge skill
- **THEN** it includes `openspec-ops merge` with `--json` and checks/squash guidance

#### Scenario: skill forbids unsolicited merge
- **WHEN** the user only asked to ship or impl-review
- **THEN** the ops-merge skill instructions require not invoking merge

### Requirement: ops-finish documents merged branch cleanup
The ops-finish skill/prompt SHALL describe that finish removes the worktree when present and, when the PR is merged, deletes local and remote branches unless `--keep-branch` is used.

#### Scenario: ops-finish mentions branch cleanup
- **WHEN** reading ops-finish after this change
- **THEN** it mentions merged PR branch deletion or keep-branch

### Requirement: ops-prune redirects to finish
The ops-prune skill/prompt SHALL state that finish is the preferred closeout command and that prune is deprecated or branch-only compatibility.

#### Scenario: ops-prune points at finish
- **WHEN** reading ops-prune after this change
- **THEN** it recommends finish for normal closeout

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

