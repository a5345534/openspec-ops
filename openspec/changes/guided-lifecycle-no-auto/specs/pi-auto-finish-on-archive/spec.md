## REMOVED Requirements

### Requirement: Harness orphan-reclaim gate without forking OpenSpec archive
**Reason:** Auto-finish orphan reclaim is removed; finish is operator-selected.

### Requirement: Detect archive intent with strong signals only for watch arm
**Reason:** No finish watch arm on archive.

### Requirement: Parse change name conservatively before arming watch
**Reason:** No auto-finish watch.

### Requirement: Default policy ask with on and off options
**Reason:** `OPENSPEC_OPS_AUTO_FINISH` is removed.

### Requirement: Act at settle check points with sticky watch not one-shot archive finish
**Reason:** No settle-time auto-finish.

### Requirement: Finish only when orphan hard conditions hold
**Reason:** Auto-finish evaluation removed; explicit finish keeps its own dirty/orphan rules.

### Requirement: Archive path is fail-open
**Reason:** Coupled to auto-finish gate; archive remains independent without finish coupling.

### Requirement: Documentation of gate, orphan semantics, and disable switch
**Reason:** Auto-finish docs removed.

### Requirement: Dirty skip message guides next steps without shipping
**Reason:** Auto-finish dirty skip path removed.

### Requirement: Finish automation never merges to main
**Reason:** Finish automation removed.

### Requirement: Auto-finish uses finish closeout semantics
**Reason:** No auto-finish invocation.

## ADDED Requirements

### Requirement: Manual ops-finish remains the finish interface
The system MUST keep `openspec-ops finish` / `/ops-finish` usable when the operator chooses finish (including via guided next-step). Finish MUST NOT be scheduled solely because archive settled.

#### Scenario: finish is explicit
- **WHEN** archive completes
- **THEN** finish does not run unless the operator selects or runs finish
