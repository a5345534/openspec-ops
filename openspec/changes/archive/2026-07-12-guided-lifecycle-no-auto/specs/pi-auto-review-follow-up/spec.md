## REMOVED Requirements

### Requirement: Follow-up turn review gate without mechanical review CLI
**Reason:** Cross-step auto-review follow-up is removed; guided next-step or manual `/ops-spec-review` only.

### Requirement: Arm review watch independent of worktree ensure
**Reason:** Review watches deleted.

### Requirement: Detect propose intent with strong signals only for review arm
**Reason:** No review arm on propose.

### Requirement: Default review policy on with off option
**Reason:** `OPENSPEC_OPS_AUTO_REVIEW` removed.

### Requirement: Fire only after settle when artifacts are ready
**Reason:** No settle-time auto fire for review.

### Requirement: Same-turn ensure-coupled review inject is not the main path
**Reason:** Capability path retired.

### Requirement: Documentation
**Reason:** README auto-review follow-up documentation requirements removed with auto-review.

### Requirement: Review watch without requiring slash change name
**Reason:** Discovery-based auto-review removed.

### Requirement: Follow-up turn runs full ops-spec-review loop
**Reason:** No auto follow-up turn.

### Requirement: Documentation mentions pre-apply eligibility
**Reason:** Auto-review eligibility docs removed with auto-review.

## MODIFIED Requirements

### Requirement: Manual ops-spec-review remains available
The system MUST keep the ops-spec-review skill/prompt usable when the operator runs it manually or selects it via guided next-step. Manual review MUST NOT depend on auto-review watches or `OPENSPEC_OPS_AUTO_REVIEW`.

#### Scenario: Manual review without auto-review
- **WHEN** the user runs `/ops-spec-review <change>` manually
- **THEN** manual review remains functional
- **AND** it does not require an auto-review watch to have been armed
