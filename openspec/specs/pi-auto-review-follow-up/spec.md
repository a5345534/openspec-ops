# pi-auto-review-follow-up Specification

## Purpose

Former auto-review follow-up after propose. Automatic scheduling is retired; manual and guided ops-spec-review remain.

## Requirements

### Requirement: Manual ops-spec-review remains available
The system MUST keep the ops-spec-review skill/prompt usable when the operator runs it manually or selects it via guided next-step. Manual review MUST NOT depend on auto-review watches or `OPENSPEC_OPS_AUTO_REVIEW`.

#### Scenario: Manual review without auto-review
- **WHEN** the user runs `/ops-spec-review <change>` manually
- **THEN** manual review remains functional
- **AND** it does not require an auto-review watch to have been armed

### Requirement: Capability auto-scheduling retired
Automatic settle-time or propose-arm scheduling of ops-spec-review SHALL NOT be required. Operators use `/ops-next` or manual `/ops-spec-review`.

#### Scenario: no auto follow-up required
- **WHEN** propose completes
- **THEN** this capability does not require a scheduled follow-up review turn
