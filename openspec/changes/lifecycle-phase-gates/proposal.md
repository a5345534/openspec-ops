## Why

Operators re-run **`/ops-spec-review`** after apply/ship/archive because nothing enforces its **pre-apply** phase, and **worktree-only archive** can leave a duplicate **active** `openspec/changes/<name>/` on primary—so `openspec status` still looks “in progress.” Real AOS pain; wastes agent turns and invites post-archive plan edits. Issue: https://github.com/a5345534/openspec-ops/issues/4

## What Changes

- **Phase gate for ops-spec-review** (skill + optional small detector helper):
  - Detect archived-only / post-apply-or-ship signals when practical
  - **Refuse** (or no-op with clear phase error) instead of full fix rounds
  - Optional explicit override for intentional historical re-review
- **Doctor / where hygiene for split-brain**:
  - Detect primary **active** change dir while same change is **archived** under a worktree (or document the inverse)
  - Issue id + remediation: do not re-spec-review; merge/sync; remove residual active
- **Docs**: reinforce default `merge → archive on mainline → finish`; call out worktree-archive + primary residual as footgun
- Keep **auto-review** post-propose only (no arm on archive/ship)

## Capabilities

### New Capabilities
- `lifecycle-phase-gates`: Phase-aware refusal for ops-spec-review and doctor/where detection of active-vs-archived location mismatch.

### Modified Capabilities
- `ops-spec-review`: Skill must check phase before review-fix loop; document override if any.
- `workspace-lifecycle` / doctor types: new doctor issue id(s) for change location mismatch.
- `worktree-loop-closure`: Docs for archive location and wrong-phase review.

## Impact

- `.pi/skills/ops-spec-review`, optional `src/` phase detector, doctor/types, README
- Reduces wrong-phase review and dual active/archive confusion
- Non-goals: full lifecycle state machine; auto-delete primary residual; changing OpenSpec archive CLI semantics; auto-merge
