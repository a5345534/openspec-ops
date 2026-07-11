## ADDED Requirements

### Requirement: Review watch without requiring slash change name
The extension SHALL be able to schedule ops-review follow-up for a change when a proposal artifact becomes ready, even if review was not armed from a slash command that included the change name.

At minimum, on agent settle (or equivalent), the extension MUST consider active changes that have `openspec/changes/<name>/proposal.md` present under resolved roots and MAY arm or fire follow-up review per existing auto-review policy (`OPENSPEC_OPS_AUTO_REVIEW`).

One-shot behavior MUST prevent repeatedly scheduling follow-up for the same change after a successful schedule in the same session (or equivalent debounce).

#### Scenario: proposal appears without prior slash name arm
- **WHEN** review policy is `on`
- **AND** `openspec/changes/add-dark-mode/proposal.md` exists under a resolved root
- **AND** no slash-propose arm was recorded for that name
- **THEN** the extension can schedule a follow-up user message to run ops-review for `add-dark-mode`

#### Scenario: auto-review off disables discovery fire
- **WHEN** `OPENSPEC_OPS_AUTO_REVIEW=off`
- **THEN** settle-time discovery does not schedule follow-up review turns

#### Scenario: already scheduled change is not re-fired immediately
- **WHEN** a follow-up review was already scheduled for `add-dark-mode` in the session
- **AND** settle runs again with the same proposal present
- **THEN** the extension does not schedule another follow-up for that change until policy/session rules allow a new arm
