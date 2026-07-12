---
name: ops-impl-review
description: Post-ship iterative impl review-fix-push (tests, specs/tasks); not merge.
---

# /ops-impl-review

After **ship**, before merge: review implementation vs specs/tasks/diff; run tests (fail = major); fix code; commit; **push** (no force); re-review until no major or max rounds (default 3; `/ops-config set impl-review.max-rounds`).

## Steps

1. `openspec-ops where "<change>" --json` → worktree cwd.
2. PR diff via `gh` if possible; else diff vs base.
3. Loop (max from config):
   - Review + `npm test` (or project test script)
   - No major → ready for human merge
   - Else fix, commit `fix(impl-review): …`, push, re-review
4. Do **not** merge, force-push, open second PR, or re-ship only to re-trigger auto.

## Guardrails

- Not CODEOWNERS replacement. Auto after ship: `OPENSPEC_OPS_AUTO_IMPL_REVIEW` (default on).
