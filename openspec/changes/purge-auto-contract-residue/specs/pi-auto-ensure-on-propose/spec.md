## MODIFIED Requirements

### Requirement: Capability retired
This capability SHALL be considered retired with **no runtime**. Operators MUST use explicit `/ops-start` and guided `/ops-next` instead of any automatic ensure-on-propose behavior. Environment variable `OPENSPEC_OPS_AUTO_START` MUST NOT be documented as a supported live switch.

#### Scenario: no auto ensure and no AUTO_START switch
- **WHEN** consulting this capability after purge-auto-contract-residue
- **THEN** it does not require automatic ensure on propose
- **AND** it does not define behavior for `OPENSPEC_OPS_AUTO_START=on|off`
