## ADDED Requirements

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
