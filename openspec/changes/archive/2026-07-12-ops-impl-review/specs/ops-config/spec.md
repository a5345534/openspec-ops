## ADDED Requirements

### Requirement: impl-review max-rounds config key
ops-config SHALL support `impl-review.max-rounds` as a positive integer (clamped to a safe range such as 1–10), resolved with session > env `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS` > default 3.

#### Scenario: session override for impl-review
- **WHEN** session sets `impl-review.max-rounds` to `5`
- **THEN** effective impl-review max rounds is 5
