## ADDED Requirements

### Requirement: Nameless ops-next discovers and selects a change
When the guided next-step entrypoint is invoked **without** a parseable kebab-case change name, the system SHALL discover candidate active changes and:

- If **zero** candidates: notify the operator and MUST NOT schedule a next lifecycle skill
- If **one** candidate: use that change and proceed to the station next-action menu
- If **multiple** candidates: present a selection UI when available (`ctx.ui.select` or equivalent); when UI is unavailable, present a textual list and MUST NOT auto-select a change or auto-schedule a skill

When a change name **is** provided, the system SHALL skip change-picking and proceed to the station menu as today.

#### Scenario: no name and no candidates
- **WHEN** operator runs `/ops-next` with no change argument
- **AND** no candidate changes are discovered
- **THEN** the system notifies that no change is available
- **AND** does not schedule a lifecycle skill

#### Scenario: no name and one candidate
- **WHEN** operator runs `/ops-next` with no change argument
- **AND** exactly one candidate change `add-dark-mode` exists
- **THEN** the system uses `add-dark-mode` for the subsequent next-action menu

#### Scenario: no name and multiple candidates with UI
- **WHEN** operator runs `/ops-next` with no change argument
- **AND** multiple candidates exist
- **AND** UI select is available
- **THEN** the operator is prompted to pick a change name
- **AND** only after a choice does the station next-action menu run for that change

#### Scenario: no name and multiple candidates without UI
- **WHEN** operator runs `/ops-next` with no change argument
- **AND** multiple candidates exist
- **AND** UI select is unavailable
- **THEN** a textual list of candidates is shown
- **AND** no change is auto-selected and no skill is auto-scheduled

#### Scenario: explicit name skips pick
- **WHEN** operator runs `/ops-next add-dark-mode`
- **THEN** the system does not require a change-pick step before the station menu

### Requirement: Candidate discovery covers worktrees and active change dirs
Candidate discovery SHALL include at least:

- Inferred change names from linked non-primary worktrees (e.g. `.worktrees/<change>`)
- Active `openspec/changes/<kebab>/` directories under resolved roots (excluding `archive/`)

#### Scenario: active change dir is a candidate
- **WHEN** `openspec/changes/add-x/` exists under a resolved root and is not only under archive
- **THEN** `add-x` MAY appear in the candidate list for nameless `/ops-next`
