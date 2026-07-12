## ADDED Requirements

### Requirement: Documented loop includes ship before merge
The recommended delivery loop documentation SHALL include an explicit **ship** (commit + push + PR) step after apply and before merge/archive/finish.

#### Scenario: README mentions ship before merge
- **WHEN** reading the recommended loop documentation after this change
- **THEN** ship or commit/PR via openspec-ops ship appears after apply and before merge
