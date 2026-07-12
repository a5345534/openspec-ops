---
name: ops-spec-review
description: Iterative OpenSpec plan/spec full-review rounds before apply (not code review). Phase-gated.
---

# /ops-spec-review

OpenSpec **plan/spec** quality gate: **phase check first**, then **full review rounds** until a full review finds **no major** or **max full-review rounds** (default 3).

**Not** code/PR review. **Pre-apply only.**

## Round semantics

- **1 round = 1 full review** of current proposal/design/specs/tasks (whole change, not only prior majors).
- If majors: **fix** + **in-round verify** (same round; do **not** count verify as Round N+1).
- After fixes, if rounds remain: **another full review** before `ready for apply`. Do not ready on verify-only.
- If first full review has zero majors: ready immediately (no filler second round).
- Prefer `openspec validate <change>`; failure → major.

## Steps

1. Resolve change via `openspec-ops where` / `openspec status` (prefer worktree path); scan primary too for archive.
2. **Phase:** if archived-only or active+archived split-brain → print phase_mismatch and **stop** (unless historical/force override).
3. Else loop (max **full** reviews from config):
   - Full review; major vs minor (uncertain → minor)
   - No major → ready for apply
   - Else fix + in-round verify; then next full review if budget remains
4. Last round fixed but no confirmatory full review left, or majors remain → needs human.

## Output

Label rounds `(full review)`; never invent a verify-only round.

## Guardrails

- Change-root artifacts only; no product src; no scope expand; no ship/merge/finish.
- Do not re-spec-review after archive without explicit historical override.
