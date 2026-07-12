## ADDED Requirements

### Requirement: Optional deliver path still ends merge then archive then finish
When operators use ops-deliver, the documented and implemented default SHALL place **merge before archive** and **finish after archive**, consistent with the recommended loop.

#### Scenario: deliver does not archive before merge
- **WHEN** deliver runs the default pipeline
- **THEN** it does not archive the OpenSpec change before merge has succeeded or the PR is already merged
