## MODIFIED Requirements

### Requirement: Manual ops-spec-review remains available
The system MUST keep the ops-spec-review skill/prompt usable when the operator runs it manually or selects it via guided next-step. Manual review MUST NOT depend on auto-review watches. Environment variable `OPENSPEC_OPS_AUTO_REVIEW` MUST NOT be documented as a supported live switch.

#### Scenario: Manual review without auto-review env
- **WHEN** the user runs `/ops-spec-review <change>` manually
- **THEN** manual review remains functional
- **AND** success does not require setting or unsetting `OPENSPEC_OPS_AUTO_REVIEW`

### Requirement: Capability auto-scheduling retired
Automatic settle-time or propose-arm scheduling of ops-spec-review SHALL NOT be required. Operators use `/ops-next` or manual `/ops-spec-review`.

#### Scenario: no auto follow-up required
- **WHEN** propose completes
- **THEN** this capability does not require a scheduled follow-up review turn
