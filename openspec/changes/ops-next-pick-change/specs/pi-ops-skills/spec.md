## ADDED Requirements

### Requirement: ops-next skill documents optional change name
The ops-next skill SHALL document that the change name argument is optional: when omitted, the operator picks (or is given) a candidate change before the next-action menu.

#### Scenario: skill mentions nameless pick
- **WHEN** reading the ops-next skill after this change
- **THEN** it describes `/ops-next` without a name and the pick-change behavior
