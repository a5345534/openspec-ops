## MODIFIED Requirements

### Requirement: Capability retired
This capability SHALL be considered retired with **no runtime**. Operators MUST choose impl-review via `/ops-next` or run `/ops-impl-review` manually. Environment variable `OPENSPEC_OPS_AUTO_IMPL_REVIEW` MUST NOT be documented as a supported live switch.

#### Scenario: no auto impl-review and no AUTO_IMPL switch
- **WHEN** consulting this capability after purge-auto-contract-residue
- **THEN** it does not require automatic impl-review after ship
- **AND** it does not define behavior for `OPENSPEC_OPS_AUTO_IMPL_REVIEW`
