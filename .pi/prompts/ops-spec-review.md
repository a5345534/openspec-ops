---
name: ops-spec-review
description: Iterative OpenSpec plan/spec review-fix before apply (not code review). Phase-gated.
---

# /ops-spec-review

OpenSpec **plan/spec** quality gate: **phase check first**, then review → **edit artifacts** → re-review until **no major** or **max rounds** (default 3).

**Not** code/PR review. **Pre-apply only.**

## Steps

1. Resolve change via `openspec-ops where` / `openspec status` (prefer worktree path); scan primary too for archive.
2. **Phase:** if archived-only or active+archived split-brain → print phase_mismatch and **stop** (unless user said historical/force override).
3. Else loop (max from config):
   - Classify major vs minor (uncertain → minor)
   - No major → ready for apply
   - Else minimal fixes under change root only; re-read
4. Still major after max → needs human.

## Guardrails

- Change-root artifacts only; no product src; no scope expand; no ship/merge/finish.
- Do not re-spec-review after archive without explicit historical override.
