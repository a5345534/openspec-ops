# Change: auto-review-skip-applied

## Why

Auto-review settle-time discovery schedules `/ops-spec-review` for **any** active change that still has `proposal.md`. Changes that are already applied (tasks complete), shipped, or merged—but not yet archived—are re-queued on every new Pi session. That fights the pre-apply role of ops-spec-review and produced spurious follow-ups (e.g. `finish-absorbs-prune`, `merge-empty-checks-allow` after merge).

## What Changes

- Tighten **auto-review readiness**: presence of `proposal.md` is necessary but **not sufficient**.
- Do **not** auto-schedule review when the change is past pre-apply, at least when:
  - `tasks.md` exists and **all** tasks are checked (`- [x]` / `- [X]`), or
  - lifecycle phase is `archived` / `active_and_archived` for that name under scanned roots
- Keep slash-arm + discovery for true pre-apply proposes.
- Manual `/ops-spec-review` unchanged (skill still phase-gates).
- Session one-shot `reviewScheduled` remains; this fix is about **eligibility**, not only debounce.

## Capabilities

### Modified Capabilities

- `pi-auto-review-follow-up`: readiness and discovery must skip applied / non-pre-apply active leftovers.

## Impact

- `src/auto-review/*` (ready / discover)
- Pi extension settle loop (uses shared ready helpers)
- Tests for auto-review
- README one-liner if readiness docs mention “proposal.md only”

## Non-goals

- Does not auto-archive or finish
- Does not change ops-spec-review skill phase rules (already pre-apply)
- Does not require GitHub PR status for readiness (optional later)
