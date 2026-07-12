## ADDED Requirements

### Requirement: Deliver uses station detection without replacing next
Lifecycle station detection used by guided next-step SHALL remain available for ops-deliver orchestration. ops-deliver selects the default happy-path action per station; ops-next continues to present the full hard-coded option set for manual choice.

#### Scenario: deliver default edge is a subset of lifecycle
- **WHEN** station is `shipped`
- **THEN** deliver’s default path includes mandatory impl-review then merge
- **AND** ops-next may still offer impl-review, ship, merge, or stop as manual options
