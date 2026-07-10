## ADDED Requirements

### Requirement: Follow-up turn review gate without mechanical review CLI
The system SHALL provide a Pi extension path that schedules a **new agent turn** to run the existing ops-review skill/prompt after propose artifacts are ready.

The extension MUST NOT implement a mechanical `openspec-ops review` CLI as the review body for this capability.

The extension MUST NOT replace or reimplement OpenSpec propose. Review scheduling MUST NOT abort or handle propose input.

#### Scenario: Review body remains ops-review skill
- **WHEN** the gate fires a follow-up review for change `add-dark-mode`
- **THEN** the scheduled user message invokes the ops-review entrypoint for `add-dark-mode` (e.g. `/ops-review add-dark-mode`)
- **AND** the extension does not perform cross-artifact review analysis itself

#### Scenario: Propose input is not cancelled by review arm
- **WHEN** the user submits `/opsx-propose add-dark-mode` and review policy is `on`
- **THEN** the original propose input is allowed to continue
- **AND** the extension does not return a handled/cancel action solely for review arming

---

### Requirement: Arm review watch independent of worktree ensure
When review policy is `on` and propose-intent is detected with a parseable kebab-case change name, the extension SHALL arm a sticky review watch for that change.

Arming the review watch MUST NOT require successful auto-ensure (or any worktree ensure outcome).

#### Scenario: Review arms when ensure is skipped or off
- **WHEN** `OPENSPEC_OPS_AUTO_START=off` (or ensure is skipped)
- **AND** the user submits `/opsx-propose add-dark-mode`
- **AND** review policy is `on`
- **THEN** a review watch for `add-dark-mode` is still armed

#### Scenario: Ensure abort clears review watch
- **WHEN** a review watch was armed for `add-dark-mode`
- **AND** auto-ensure hard-fails and aborts propose continuation for that input (e.g. missing binary or conflict `handled`)
- **THEN** the extension clears the review watch for `add-dark-mode`
- **AND** does not schedule a follow-up review turn for that arm

#### Scenario: Review does not arm without change name
- **WHEN** the user submits `/opsx-propose` with no parseable change name
- **AND** review policy is `on`
- **THEN** the extension does not arm a review watch

---

### Requirement: Detect propose intent with strong signals only for review arm
The extension SHALL arm review watches only for strong slash propose forms, including at least:

- `/opsx-propose` at the start of input
- `/opsx:propose` at the start of input if supported

The extension MUST NOT treat bare-word chat containing “propose” as propose-intent for this capability.

#### Scenario: opsx-propose arms when name present
- **WHEN** input is `/opsx-propose add-dark-mode`
- **AND** review policy is `on`
- **THEN** the extension arms a review watch for `add-dark-mode`

#### Scenario: explore does not arm review
- **WHEN** input begins with `/opsx-explore`
- **THEN** the extension does not arm a review watch for that input

---

### Requirement: Default review policy on with off option
The extension SHALL support review policy values `on` and `off`.

The default MUST be `on` when unset.

Policy MUST be readable from `OPENSPEC_OPS_AUTO_REVIEW` (`on`|`off`, case-insensitive).

#### Scenario: Default is on
- **WHEN** `OPENSPEC_OPS_AUTO_REVIEW` is unset
- **THEN** the extension behaves as policy `on`

#### Scenario: Off disables follow-up review
- **WHEN** `OPENSPEC_OPS_AUTO_REVIEW=off`
- **THEN** propose-intent does not arm a review watch and no follow-up review turn is scheduled by this gate

---

### Requirement: Fire only after settle when artifacts are ready
The extension MUST NOT schedule the follow-up review turn during the propose `input` handler.

When a review watch is armed, the extension SHALL re-evaluate readiness on `agent_settled` (or equivalent post-run settle hook).

**v1 readiness:** `openspec/changes/<change>/proposal.md` exists under a resolved project/primary path (and/or active workspace path when known).

- If not ready: MUST keep the watch and MUST NOT schedule follow-up review
- If ready: MUST clear the watch and MUST schedule exactly one follow-up user message that starts ops-review for that change

#### Scenario: Not ready keeps watch
- **WHEN** a review watch is armed for `add-dark-mode`
- **AND** settle runs
- **AND** `proposal.md` is not present for that change
- **THEN** the extension does not schedule a follow-up review turn
- **AND** the watch remains armed

#### Scenario: Ready schedules follow-up review turn
- **WHEN** a review watch is armed for `add-dark-mode`
- **AND** settle runs
- **AND** `openspec/changes/add-dark-mode/proposal.md` exists
- **THEN** the extension schedules a follow-up user message to run ops-review for `add-dark-mode`
- **AND** the watch is cleared so a later settle does not schedule a second review for the same arm

#### Scenario: No finish-style CLI review
- **WHEN** the gate schedules review
- **THEN** it does so via a new agent turn (follow-up user message), not via an `openspec-ops review` CLI invocation

---

### Requirement: Same-turn ensure-coupled review inject is not the main path
The extension MUST NOT rely on ensure-success-only same-turn `before_agent_start` review injection as the primary auto-review mechanism.

After this capability is implemented, auto-review primary behavior SHALL be the settle + follow-up path defined above.

#### Scenario: Ensure failure path does not solely own review arming
- **WHEN** review policy is `on` and a parseable propose name is present
- **THEN** review watch arming does not require `ensureWorkspace` status `ok`

---

### Requirement: Manual ops-review remains available
The system MUST keep the ops-review skill/prompt usable manually when auto-review is off or when no watch was armed.

#### Scenario: Manual review with policy off
- **WHEN** `OPENSPEC_OPS_AUTO_REVIEW=off`
- **AND** the user runs `/ops-review <change>` manually
- **THEN** manual review remains functional

---

### Requirement: Documentation
The root README SHALL document:

- That auto-review opens a **follow-up turn** to run ops-review after propose artifacts are ready
- That arming is independent of auto-ensure
- `OPENSPEC_OPS_AUTO_REVIEW=on|off` (default `on`)
- That v1 readiness is presence of `proposal.md`
- That no mechanical review CLI is required
- That slash propose with kebab name is required to arm

#### Scenario: README describes follow-up review turn
- **WHEN** reading the root README after this change
- **THEN** it describes settle/follow-up auto-review behavior and the off switch
