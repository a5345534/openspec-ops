## MODIFIED Requirements

### Requirement: Fire only after settle when artifacts are ready
The extension MUST NOT schedule the follow-up review turn during the propose `input` handler.

When a review watch is armed, the extension SHALL re-evaluate readiness on `agent_settled` (or equivalent post-run settle hook).

**Readiness (auto-schedule eligibility):** all of:

1. `openspec/changes/<change>/proposal.md` exists under a resolved project/primary path (and/or active workspace path when known)
2. The change is still a **pre-apply** auto-review candidate under scanned roots:
   - MUST NOT be eligible solely because `proposal.md` remains after implementation
   - If `tasks.md` exists under a change root and contains task checkboxes, and **no** open checkbox (`- [ ]`) remains, the change MUST be treated as **not ready** for auto-review scheduling
   - If lifecycle phase detection for the change is `archived` or `active_and_archived` under scanned roots, the change MUST be treated as **not ready** for auto-review scheduling
3. If `tasks.md` is missing, or has no task checkboxes, criterion (2) task rule does not by itself exclude the change (proposal-only mid-propose remains eligible)

Behavior:

- If not ready: MUST keep the watch only when still plausibly pre-apply (e.g. proposal missing); when ineligible because tasks complete or phase non-ok, MUST clear the watch and MUST NOT schedule follow-up review
- If ready: MUST clear the watch and MUST schedule exactly one follow-up user message that starts ops-spec-review for that change

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
- **AND** the change is still pre-apply eligible (e.g. no tasks.md, or tasks.md has an open `- [ ]`)
- **THEN** the extension schedules a follow-up user message to run ops-spec-review for `add-dark-mode`
- **AND** the watch is cleared so a later settle does not schedule a second review for the same arm

#### Scenario: All tasks complete skips auto-review
- **WHEN** `openspec/changes/add-dark-mode/proposal.md` exists
- **AND** `tasks.md` exists with task checkboxes and no open `- [ ]`
- **AND** settle runs (with or without a prior slash arm)
- **THEN** the extension does not schedule a follow-up review turn for `add-dark-mode`

#### Scenario: No finish-style CLI review
- **WHEN** the gate schedules review
- **THEN** it does so via a new agent turn (follow-up user message), not via an `openspec-ops review` CLI invocation

---

### Requirement: Review watch without requiring slash change name
The extension SHALL be able to schedule ops-spec-review follow-up for a change when a proposal artifact becomes ready **and the change is still pre-apply eligible**, even if review was not armed from a slash command that included the change name.

At minimum, on agent settle (or equivalent), the extension MUST consider active changes that meet auto-review readiness (proposal present and pre-apply eligible) under resolved roots and MAY arm or fire follow-up review per existing auto-review policy (`OPENSPEC_OPS_AUTO_REVIEW`).

Discovery MUST use the same readiness rules as the armed-watch fire path (including skip when tasks are all complete).

One-shot behavior MUST prevent repeatedly scheduling follow-up for the same change after a successful schedule in the same session (or equivalent debounce).

#### Scenario: proposal appears without prior slash name arm
- **WHEN** review policy is `on`
- **AND** `openspec/changes/add-dark-mode/proposal.md` exists under a resolved root
- **AND** the change is pre-apply eligible
- **AND** no slash-propose arm was recorded for that name
- **THEN** the extension can schedule a follow-up user message to run ops-spec-review for `add-dark-mode`

#### Scenario: discovery skips applied leftover change
- **WHEN** review policy is `on`
- **AND** an active change still has `proposal.md` after tasks are all checked
- **AND** settle runs
- **THEN** settle-time discovery does not schedule follow-up review for that change

#### Scenario: auto-review off disables discovery fire
- **WHEN** `OPENSPEC_OPS_AUTO_REVIEW=off`
- **THEN** settle-time discovery does not schedule follow-up review turns

#### Scenario: already scheduled change is not re-fired immediately
- **WHEN** a follow-up review was already scheduled for `add-dark-mode` in the session
- **AND** settle runs again with the same proposal present
- **THEN** the extension does not schedule another follow-up for that change until policy/session rules allow a new arm

---

## ADDED Requirements

### Requirement: Documentation mentions pre-apply eligibility
The root README auto-review section SHALL note that auto-review requires proposal readiness **and** pre-apply eligibility (e.g. skips when tasks are all complete), not merely leftover `proposal.md` after apply.

#### Scenario: README mentions skip when applied
- **WHEN** reading the root README auto-review section after this change
- **THEN** it states that fully checked tasks (or equivalent post-apply signal) suppress auto-schedule
