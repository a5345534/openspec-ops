## REMOVED Requirements

### Requirement: Auto impl-review after successful ship with default on
**Reason:** Ship MUST NOT automatically start ops-impl-review. `OPENSPEC_OPS_AUTO_IMPL_REVIEW` is removed.

### Requirement: Auto impl-review does not merge
**Reason:** Auto impl-review path removed; manual/guided impl-review still MUST NOT merge (covered by ops-impl-review capability).

### Requirement: Impl-review push does not re-arm ship auto chain
**Reason:** No ship auto chain remains to re-arm.
