## ADDED Requirements

### Requirement: Doctor can flag change location mismatch
Doctor issue taxonomy SHALL include the stable id **`change_location_mismatch`** for active-vs-archived change location mismatch.

#### Scenario: issue id is stable
- **WHEN** doctor reports the split-brain condition
- **THEN** the issue id is `change_location_mismatch`
