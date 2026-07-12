# Change: spec-review-round-semantics

## Why

`ops-spec-review` is specified as review → fix → re-review until no majors, but agents commonly treat **round 2 as “verify previous fixes only”**, not a full independent review. Operators want:

1. Each **review round** = a **full** review of current artifacts (not fix-verification alone).
2. After fixing majors, **in-round verify** that those fixes landed—at the **end of the same round**, not as the next numbered review round.
3. If majors were fixed, a **subsequent full review round** is required before `ready for apply` (when max-rounds remain)—so “round 2 no major” means a second full pass is clean, not rubber-stamp QA.

## What Changes

- Clarify **round semantics** in `ops-spec-review` skill (+ main/delta specs):
  - **1 round = 1 full review** (+ optional fix + **in-round verify** of those fixes)
  - In-round verify MUST NOT be reported as a separate review round
  - Full re-review MUST NOT be limited to the prior major list (prior list is optional supplement only)
  - **After any fix of majors in a round**, if rounds remain: run another **full** review round before declaring ready (unless max-rounds exhausted → needs human if majors remain after last verify)
  - If a full review finds **zero** majors: ready immediately (no empty second round)
- Update output template: label rounds as `(full review)`; separate `In-round fix+verify` from next full round
- Optionally: recommend `openspec validate` failure as major within full review (if not already implied)
- Same semantics apply to wording shared with ops-impl-review only if we touch it; **default scope is ops-spec-review only** (impl-review may get a one-line “consider aligning later”)

## Capabilities

### Modified Capabilities

- `ops-spec-review`: round = full review; in-round verify; post-fix requires next full round when budget remains
- `pi-ops-skills`: ops-spec-review skill text matches new semantics

## Impact

- Skill/prompt behavior change for agents; more often true second full pass after fixes
- May use more of max-rounds=3 when R1 had majors (R1 fix+verify, R2 full)
- No runtime CLI change required unless we add a tiny helper (not required)

## Non-goals

- Changing default max-rounds (stays 3)
- Mechanical second-model reviewer
- Requiring R2 when R1 full review already has zero majors
- Expanding major checklist scope beyond current examples (unless validate is added as major)
