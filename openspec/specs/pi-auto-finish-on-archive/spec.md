# pi-auto-finish-on-archive Specification

## Purpose

Former auto-finish after archive. Retired; use guided next-step or /ops-finish.

## Requirements

### Requirement: Capability retired
This capability SHALL be considered retired. Operators MUST use guided next-step (`/ops-next`) and explicit lifecycle commands instead of automatic cross-step scheduling described by the former requirements of this capability.

#### Scenario: no auto behavior required
- **WHEN** consulting this capability after guided-lifecycle-no-auto
- **THEN** it does not require automatic ensure, review, finish, or impl-review chaining
