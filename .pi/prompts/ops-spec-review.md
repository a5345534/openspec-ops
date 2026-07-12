---
name: ops-spec-review
description: Iterative OpenSpec plan/spec review-fix before apply (not code review).
---

# /ops-spec-review

OpenSpec **plan/spec** quality gate: review → **edit artifacts** → re-review until **no major** findings or **max rounds** (default 3; `/ops-config set spec-review.max-rounds N` or env `OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS`).

**Not** code/PR review.

## Steps

1. Resolve change via `openspec-ops where` / `openspec status` (prefer worktree path).
2. Read proposal, design, specs, tasks.
3. Loop (max from injected config / default 3):
   - Classify major vs minor (uncertain → minor)
   - No major → verdict ready for apply; stop
   - Else minimal fixes under change root only; re-read
4. Still major after max → needs human.

## Guardrails

- Change-root artifacts only; no product src; no scope expand; no ship/merge/finish.
