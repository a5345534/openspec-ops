## MODIFIED Requirements

### Requirement: Capability retired
This capability SHALL be considered retired with **no runtime**. Operators MUST use guided next-step or `/ops-finish` explicitly. Environment variable `OPENSPEC_OPS_AUTO_FINISH` MUST NOT be documented as a supported live switch.

#### Scenario: no auto finish and no AUTO_FINISH switch
- **WHEN** consulting this capability after purge-auto-contract-residue
- **THEN** it does not require automatic finish after archive
- **AND** it does not define behavior for `OPENSPEC_OPS_AUTO_FINISH`
