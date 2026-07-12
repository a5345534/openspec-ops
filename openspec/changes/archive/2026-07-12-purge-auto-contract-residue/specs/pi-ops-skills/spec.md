## ADDED Requirements

### Requirement: Packaged extension name is guided not auto-ensure
The packaged Pi extension file name and package-facing description SHALL reflect guided lifecycle (explicit start + next-step), not auto-ensure/auto-review branding.

#### Scenario: extension file is not auto-ensure-named as the live entry
- **WHEN** listing packaged `.pi/extensions` after this change
- **THEN** the live guided extension is not solely presented under a filename that implies auto-ensure is the product

### Requirement: Docs list retired auto capabilities
Root README (or equivalent) SHALL list former `pi-auto-*` auto-scheduling capabilities as retired with no runtime, pointing operators to `/ops-start` and `/ops-next`.

#### Scenario: README has retired auto map
- **WHEN** reading the root README after this change
- **THEN** it indicates auto ensure/review/finish/impl-review env/automation are retired
