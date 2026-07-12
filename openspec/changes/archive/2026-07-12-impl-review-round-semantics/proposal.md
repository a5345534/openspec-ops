# Change: impl-review-round-semantics

## Why

`ops-spec-review` now defines **full review rounds** with **in-round fix verify** (not verify-as-next-round). `ops-impl-review` still uses vague “review → fix → push → re-review”, so agents often treat round 2 as “tests green after my push” instead of a full independent review of code vs specs/tasks/diff. Operators want the **same round semantics** post-ship.

## What Changes

- Align `ops-impl-review` skill/prompt/spec with spec-review round model:
  - **1 round = 1 full impl review** (specs/tasks + PR/diff vs base + tests when available)
  - Full review scope is the **current** implementation state, not only files touched in the previous fix list
  - On majors: fix → commit/push (no force) → **in-round verify** (re-run tests; confirm majors addressed)—verify is **not** a separate review round
  - After fixes, if full-review rounds remain: **another full review** before `ready for human merge`
  - Ready only when a **full review** finds zero majors (not verify-only / tests-green-only after push)
  - If last full review found majors, fixed+verified in-round, but no confirmatory full review left → **needs human**
  - Zero majors on first full review → ready immediately
- Forbidden: labeling a verify-only / “re-ran tests after push” pass as Round N
- Keep: test non-zero = major; no merge; no force-push; max-rounds default 3

## Capabilities

### Modified Capabilities

- `ops-impl-review`: iterative loop = full-review rounds + in-round fix/push/verify
- `pi-ops-skills`: ops-impl-review skill documents full-review round semantics

## Impact

- Skill/spec only (no CLI required)
- After R1 fixes, R2 becomes a real second full pass when budget remains
- Slightly more agent work when R1 had majors

## Non-goals

- Changing default max-rounds
- Auto-merge or CODEOWNERS replacement
- Requiring a second model/reviewer
- Changing ship/merge chain
