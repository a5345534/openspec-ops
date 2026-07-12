# Design: merge-empty-checks-allow

## Decision

| State | Behavior |
|---|---|
| Checks all success/skip/neutral | Allow merge |
| Any pending/fail/cancel | `checks_failed` |
| Zero checks / “no checks reported” | **Allow** (default) |
| Same + `OPENSPEC_OPS_MERGE_EMPTY_CHECKS=refuse` | `checks_failed` |

## Rationale

- Merge invoke is already explicit consent.
- Real enforcement for required checks belongs to GitHub branch protection (gh merge will still fail if protected).
- Fail-closed empty made ops-merge unusable on repos without workflows.

## Alternatives

- Default refuse + env allow — keeps status quo pain.
- Always allow empty with no env — less control for strict teams; env refuse covers them.

## Risks

- If gh transiently returns empty while checks exist, could merge early. Mitigated by branch protection; rare vs permanent empty-CI friction.
