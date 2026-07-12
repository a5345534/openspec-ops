## ADDED Requirements

### Requirement: ops-impl-review skill documents full-review round semantics
The ops-impl-review skill SHALL document that:

- A review round is a full review of current implementation vs plan/diff/tests
- Fix, push, and verification of those fixes are in-round and not a separate review round
- After fixing majors, another full review is required before ready when rounds remain
- Ready requires a full review with zero majors (not tests-green-only after push)

#### Scenario: skill states full review vs in-round verify
- **WHEN** reading the ops-impl-review skill after this change
- **THEN** it distinguishes full review rounds from in-round fix/push/verify
- **AND** it does not instruct agents to use a verify-only or tests-only pass as the next numbered review round
