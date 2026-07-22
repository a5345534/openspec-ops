# ops-deliver Specification

## Purpose

Batch start-to-finish lifecycle after explore with mandatory reviews and merge-on-invoke consent.
## Requirements
### Requirement: ops-deliver orchestrates start through finish after explore
The system SHALL provide an operator entrypoint `/ops-deliver` (skill/prompt) that, given a kebab-case change name, orchestrates the default lifecycle from worktree start through finish for that change.

Deliver MUST NOT perform open-ended explore. Explore is out of scope for this entrypoint.

#### Scenario: deliver requires change name
- **WHEN** the operator invokes deliver without a parseable change name
- **THEN** the system asks for or rejects until a kebab-case name is provided
- **AND** does not invent a change name silently

### Requirement: Default pipeline order
Unless already past a station (resume), deliver SHALL advance in this order:

start → propose → spec-review → apply → ship → impl-review → merge → archive → finish

#### Scenario: happy path order
- **WHEN** deliver runs on a change with no worktree and no artifacts
- **THEN** it attempts start and propose before apply and ship
- **AND** runs archive only after merge success (or already merged)

### Requirement: Spec-review and impl-review are mandatory
Deliver MUST run ops-spec-review after propose artifacts are ready and before apply proceeds, and MUST run ops-impl-review after ship and before merge.

Deliver MUST NOT provide a skip-review mode in v1.

If either review ends in needs-human (or equivalent non-ready), deliver MUST stop without merge.

#### Scenario: spec-review blocks apply and merge
- **WHEN** spec-review does not reach ready for apply
- **THEN** deliver does not proceed to apply or later merge in that run

#### Scenario: impl-review blocks merge
- **WHEN** ship has succeeded and impl-review does not reach ready for human merge
- **THEN** deliver does not merge the PR in that run

### Requirement: Deliver invoke authorizes merge when gates pass
Invoking deliver SHALL constitute operator consent to squash-merge the change PR when ship has succeeded, impl-review is ready, and merge checks policy allows.

Deliver MUST call merge without requiring a separate `/ops-merge` confirmation step.

#### Scenario: merge runs without second prompt
- **WHEN** station is ready to merge under deliver rules
- **THEN** deliver invokes merge as part of the same deliver operation consent model

#### Scenario: checks failure stops deliver
- **WHEN** merge fails due to checks_failed
- **THEN** deliver stops and does not archive or finish

### Requirement: Resume from current station
Re-invoking deliver for the same change SHALL continue from the current lifecycle station rather than restarting from start when work is already partially done.

#### Scenario: already shipped resumes at impl-review
- **WHEN** the change already has an open PR and tasks are complete
- **THEN** deliver does not require re-propose
- **AND** proceeds with mandatory impl-review before merge

### Requirement: No force finish in v1
Deliver MUST NOT pass `--force` to finish. If finish fails due to dirty worktree, deliver MUST stop.

#### Scenario: dirty finish stops pipeline
- **WHEN** finish would require `--force` because the worktree is dirty
- **THEN** deliver does not force-remove
- **AND** stops with guidance

### Requirement: Coexists with ops-next
Deliver MUST NOT remove or disable `/ops-next` single-step selection. Operators MAY use ops-next when deliver stops or instead of deliver.

#### Scenario: next remains available
- **WHEN** deliver stops on needs-human
- **THEN** documentation or messaging MAY point at `/ops-next` for manual continuation

### Requirement: Extension command binds change name for slash ops-deliver
The Pi extension SHALL register an `ops-deliver` command that parses a kebab-case change name from slash command arguments (or candidate pick when the name is omitted and candidates exist), resolves a validated openspec-ops executable for the loaded package session, and schedules the ops-deliver skill follow-up with both the change name and exact executable path explicitly bound in the follow-up message.

The system MUST NOT require the agent to rediscover the change name or package-local executable solely from an empty args payload/PATH when the extension already received the name and resolved its runtime. If no executable can be validated, the extension SHALL report a clear hard stop and SHALL NOT schedule the deliver follow-up.

#### Scenario: slash with name schedules deliver for that change
- **WHEN** the operator runs `/ops-deliver eve-via-litellm-gateway`
- **AND** the extension is loaded from a project-local package with a usable bundled CLI
- **THEN** a follow-up is scheduled that states the change name is `eve-via-litellm-gateway`
- **AND** binds the validated absolute openspec-ops executable path
- **AND** the agent is instructed not to claim the change name or binary is missing

#### Scenario: slash without name uses candidate pick when available
- **WHEN** the operator runs `/ops-deliver` with no change argument
- **AND** candidate changes exist
- **THEN** the extension prompts to pick a change (or uses the sole candidate)
- **AND** then schedules deliver for the chosen name with the resolved runtime binding

#### Scenario: slash without name and no candidates
- **WHEN** the operator runs `/ops-deliver` with no change argument
- **AND** no candidates are discovered
- **THEN** the extension notifies usage / how to start
- **AND** does not schedule a deliver pipeline

#### Scenario: runtime unavailable before scheduling
- **WHEN** the loaded package CLI, explicit override, and PATH do not yield a validated executable
- **THEN** the extension reports the binary resolution hard stop
- **AND** does not schedule the deliver follow-up

### Requirement: Single slash surface for ops-deliver
The package SHALL expose at most one invokable slash command named `ops-deliver` from the openspec-ops package resources: the guided extension `registerCommand("ops-deliver")`.

The package MUST NOT ship a prompt template file that registers the same slash name `ops-deliver` (e.g. `.pi/prompts/ops-deliver.md`).

The ops-deliver skill MAY remain available as a skill (including `/skill:ops-deliver`) for agent-loaded instructions.

#### Scenario: no packaged prompt collides with extension command
- **WHEN** the openspec-ops package is installed from a release that includes this change
- **THEN** package files do not include `.pi/prompts/ops-deliver.md`
- **AND** the extension still registers `ops-deliver` for slash invocation with change-name binding

#### Scenario: skill instructions remain available
- **WHEN** an agent loads the ops-deliver skill
- **THEN** full pipeline instructions are still present under `.pi/skills/ops-deliver/`

### Requirement: Deliver documents return-to-main versus lifecycle success
The ops-deliver skill/prompt documentation SHALL state that completing the lifecycle through finish means stations through worktree closeout succeeded on the change, and that matching the operator mental model “primary on main and fully synced” may require an additional primary pull and submodule update unless opt-in finish sync flags were used.

Deliver MUST NOT treat primary lagging `origin/<base>` alone as a failed deliver when sync was not requested.

#### Scenario: deliver docs mention primary sync is separate
- **WHEN** reading ops-deliver instructions after this change
- **THEN** they distinguish lifecycle finish success from optional primary return-to-main sync
- **AND** they reference the recommended monorepo checklist or finish sync flags

### Requirement: Deliver finish expects multi-head parent branch hygiene
The ops-deliver skill SHALL treat successful finish closeout as including parent branch hygiene for the change-default head when that head’s PR is merged (in addition to the located worktree head when different), subject to finish’s existing merged-PR gates and `--keep-branch`.

Deliver MUST NOT require a separate deprecated `prune` step solely to delete the change-named parent branch after an archive branch switch. Deliver MUST NOT claim that submodule feature remotes are deleted by default finish.

#### Scenario: deliver docs state finish covers change-default head
- **WHEN** reading ops-deliver instructions after this change
- **THEN** they state that finish attempts cleanup of the change-default parent branch as well as a different located head when present
- **AND** they do not instruct a mandatory post-finish `ops-prune` solely for the change-named parent branch under the happy path

#### Scenario: deliver does not promise submodule remote prune
- **WHEN** reading ops-deliver closeout guidance after this change
- **THEN** residual submodule feature branches/remotes are described as outside default finish deletion (diagnostics / separate opt-in)

---

### Requirement: Deliver does not enable primary sync by default
`/ops-deliver` MUST NOT pass `--sync-primary`, `--sync-submodules`, `--attach-submodule-main`, or `--return-to-main` to finish when the effective `finish.return-to-main` policy is `off`.

When the effective policy is `primary-only`, deliver SHALL pass `--sync-primary` and `--sync-submodules` at its final finish station and MUST NOT pass `--return-to-main` or `--attach-submodule-main` solely due to that policy.

When the effective policy is `required`, deliver SHALL pass the strict composite `--return-to-main` behavior at its final finish station.

#### Scenario: default deliver finish has no sync flags
- **WHEN** deliver runs finish with effective `finish.return-to-main=off`
- **THEN** finish is invoked without sync-primary, sync-submodules, attach-submodule-main, or return-to-main

#### Scenario: configured deliver uses primary-only closeout
- **WHEN** deliver reaches finish with effective `finish.return-to-main=primary-only`
- **THEN** it invokes finish with `--sync-primary` and `--sync-submodules`
- **AND** it does not pass `--return-to-main` solely due to the policy

#### Scenario: configured deliver requires return to main
- **WHEN** deliver reaches finish with effective `finish.return-to-main=required`
- **THEN** it invokes finish with `--return-to-main`
- **AND** it does not report lifecycle completion unless strict closeout succeeds

#### Scenario: strict closeout needs human
- **WHEN** configured deliver receives `return_to_main_needs_human` from finish
- **THEN** deliver hard-stops with the structured primary/submodule diagnostics
- **AND** it does not force, retry destructively, or claim local return-to-main success

### Requirement: Deliver preserves one resolved CLI runtime throughout the pipeline
A deliver invocation originating from the guided extension SHALL use the extension-resolved openspec-ops executable for every CLI-backed lifecycle action in that pipeline, including start, where/station preflight, ship, merge, and finish. The agent MUST quote the bound path or inherited `OPENSPEC_OPS_BIN` safely and MUST NOT substitute raw Git, `npx`, or an unrelated PATH binary.

#### Scenario: project-local package completes start without global link
- **WHEN** openspec-ops is installed as a project-local Pi git package
- **AND** `OPENSPEC_OPS_BIN` is unset
- **AND** no `openspec-ops` command exists on PATH
- **AND** the package-local bin is executable
- **THEN** `/ops-deliver <change>` reaches and executes start with that package-local bin
- **AND** no `npm link` step is required

#### Scenario: later deliver stages retain the same runtime
- **WHEN** a package-originated deliver advances from start to later CLI-backed stations
- **THEN** ship, merge, and finish use the same bound executable identity unless the invocation hard-stops

#### Scenario: explicit operator override remains authoritative
- **WHEN** the Pi process starts with a valid explicit `OPENSPEC_OPS_BIN`
- **THEN** the extension binds that executable rather than replacing it with the package-local or PATH candidate

#### Scenario: bound executable disappears
- **WHEN** a previously bound executable is missing or non-executable before a later action
- **THEN** deliver hard-stops with executable guidance
- **AND** does not fall back to raw lifecycle Git commands

### Requirement: Deliver slash handoff avoids the compaction flush call stack
After `/ops-deliver` has validated its change and runtime binding, the extension SHALL defer its `sendUserMessage` call to a later host task and SHALL deliver the pipeline handoff as `followUp`. The handoff MUST be sent at most once and MUST never use `steer`.

#### Scenario: deliver invoked during busy or compaction-adjacent handling
- **WHEN** Pi dispatches `/ops-deliver` while busy or while flushing compaction-queued input
- **THEN** the slash handler does not synchronously start the deliver turn inside that dispatch stack
- **AND** a later host task sends exactly one bound deliver follow-up
- **AND** the delivery mode is `followUp`

#### Scenario: idle deliver invocation remains non-interrupting
- **WHEN** `/ops-deliver` is invoked while the host is idle
- **THEN** it still sends exactly one deferred `followUp` handoff with the validated change and runtime binding

### Requirement: Deliver scheduling notification follows API acceptance
The extension SHALL notify that ops-deliver was queued only after the deferred send API returns without throwing. If the API throws synchronously, the extension SHALL report that deliver was not queued, MUST NOT emit successful scheduling wording, and MUST NOT automatically retry the handoff.

#### Scenario: deliver sender accepts
- **WHEN** the deferred deliver sender returns without throwing
- **THEN** the extension reports that ops-deliver was queued for the selected change

#### Scenario: deliver sender rejects
- **WHEN** the deferred deliver sender throws
- **THEN** the extension reports that ops-deliver was not queued
- **AND** does not report successful scheduling
- **AND** invokes the sender only once

### Requirement: Deliver compatibility workaround is traceable
Documentation for the deferred handoff SHALL identify Pi 0.80.7 as an affected version and reference upstream issue `earendil-works/pi#6728`. Removal of the workaround SHALL require a supported Pi version with a verified queue-flush fix while retaining regression coverage for exactly-once follow-up delivery.

#### Scenario: maintainer evaluates workaround removal
- **WHEN** a maintainer inspects the handoff implementation or compatibility documentation
- **THEN** the affected Pi version and upstream issue are discoverable
- **AND** the retained regression expectation is explicit

### Requirement: Deliver handoff preserves the operator conversation language
The guided extension SHALL bind the active session response-language contract into the extension-generated `/ops-deliver` follow-up. The English control text in that follow-up MUST NOT cause the pipeline to switch away from the operator language.

#### Scenario: Chinese deliver invocation
- **WHEN** the active response language is `zh-Hant`
- **AND** `/ops-deliver` generates its bound follow-up
- **THEN** the follow-up requires conversational lifecycle reporting in Traditional Chinese
- **AND** retains technical commands and identifiers unchanged

#### Scenario: unknown language hint
- **WHEN** no high-confidence locale is stored
- **THEN** deliver instructs the agent to mirror the latest genuine operator-authored language
- **AND** not to infer language from extension-generated English control text

