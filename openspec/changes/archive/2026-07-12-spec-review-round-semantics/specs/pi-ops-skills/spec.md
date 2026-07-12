## ADDED Requirements

### Requirement: ops-spec-review skill documents full-review round semantics
The ops-spec-review skill SHALL document that:

- A review round is a full review of current artifacts
- Fix verification is in-round and not a separate review round
- After fixing majors, another full review is required before ready when rounds remain
- Ready requires a full review with zero majors

#### Scenario: skill states full review vs in-round verify
- **WHEN** reading the ops-spec-review skill after this change
- **THEN** it distinguishes full review rounds from in-round fix verification
- **AND** it does not instruct agents to use a verify-only pass as the next numbered review round
