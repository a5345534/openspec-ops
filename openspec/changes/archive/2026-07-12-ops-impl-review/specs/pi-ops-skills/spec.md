## ADDED Requirements

### Requirement: ops-impl-review skill and prompt exist
Package-exported ops skills/prompts SHALL include `ops-impl-review` describing the post-ship iterative implementation review-fix-push loop, test expectations, and max-rounds config.

#### Scenario: ops-impl-review skill present
- **WHEN** inspecting ops-* skills after this change
- **THEN** ops-impl-review exists and mentions ship-after timing and tests

### Requirement: ops-ship skill points to impl-review when auto on
The ops-ship skill/prompt SHALL instruct that after successful ship, when auto impl-review policy is on (default), the agent continues with `/ops-impl-review <change>`.

#### Scenario: ops-ship mentions impl-review follow-through
- **WHEN** reading the ops-ship skill after this change
- **THEN** it mentions ops-impl-review or AUTO_IMPL_REVIEW after success
