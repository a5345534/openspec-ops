# Design: auto-review-skip-applied

## Problem

```text
agent_settled → discover all openspec/changes/*/proposal.md
             → fire /ops-spec-review once per session per name
```

Leftover active dirs after apply/merge keep `proposal.md` until archive → false positives.

## Decision

### Readiness = pre-apply candidate

A change is **auto-review eligible** only if:

1. `proposal.md` exists under a scanned root (unchanged), **and**
2. Not excluded by post-apply / phase guards:
   - If `tasks.md` exists and every task checkbox line is complete → **ineligible**
   - If no incomplete `- [ ]` remains (and at least one `- [x]` or file has only completed boxes) → **ineligible**
   - If `tasks.md` missing → still eligible (propose mid-flight; v1 often creates proposal first)
   - If phase helper would report `archived` or `active_and_archived` for that change under roots → **ineligible**

### Checkbox parsing (minimal)

- Count lines matching task boxes: `- [ ]` / `- [x]` / `- [X]` (optional bold/space variants as already common in tasks.md)
- Incomplete if any `- [ ]` (case-sensitive open box)
- If file has zero checkbox lines → treat as **eligible** (don't block empty stubs)
- If checkboxes exist and none are open → **ineligible**

### Discovery

`discoverReadyProposalChanges` MUST use the same eligibility as fire path (not proposal-only).

### Slash watches

Armed watches on settle still require eligibility before schedule. If ineligible, **clear the watch** without scheduling (avoid zombie re-check forever). Prefer clear-on-ineligible so applied changes don't linger in `reviewWatches`.

### Session one-shot

Keep `reviewScheduled`. Eligibility is additional.

## Alternatives rejected

| Approach | Why not alone |
|---|---|
| Only session debounce | New session re-fires forever until archive |
| Require slash arm only | Breaks intercept / nameless propose discovery |
| Require open PR | Too GitHub-coupled; apply-before-ship still needs skip |
| mtime “new this session” | Fragile across machines / clock |

## Risks

- User checks all tasks before wanting review → no auto-review; **manual** `/ops-spec-review` still works.
- User leaves one task open forever → still auto-eligible once per session; acceptable.

## Implementation sketch

```text
isAutoReviewEligible(change, roots):
  if !isProposalReady → false
  if phase archived|split → false
  if tasks.md present && hasCheckboxes && !hasOpenCheckbox → false
  return true
```

Wire discover + extension settle filter through this helper.
