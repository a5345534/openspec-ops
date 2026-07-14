---
name: ops-impl-review
description: Post-ship impl full-review rounds (fix+push in-round; not verify-as-round).
---

# /ops-impl-review

After **ship**, before merge: **full review rounds** of implementation vs specs/tasks/diff; run tests (fail = major); fix code; commit; **push** (no force); in-round verify; if fixes and rounds remain → **another full review** until a full review finds no major or max full-review rounds (default 3; `/ops-config set impl-review.max-rounds`).

## Round semantics

- **1 round = 1 full review** (specs/tasks + diff/PR + tests)—not limited to prior fix list.
- Majors → fix → commit/push → **in-round verify** (same round; do not count as Round N+1).
- After fixes, if budget remains → **another full review** before ready.
- Ready only when a **full review** has zero majors (not tests-green-only after push).
- First full review already clean → ready immediately.

## Steps

1. `openspec-ops where "<change>" --json` → worktree cwd.
2. PR diff via `gh` if possible; else diff vs base.
3. Loop (max **full** reviews from config):
   - Emit `<!-- ops-metrics:stage {"change":"<change>","action":"ops-impl-review","round":<N>} -->`
   - Full review + tests
   - No major → ready for human merge
   - Else fix, commit, push, in-round verify; then next full review if budget remains
   - End every full round with the structured review marker below
4. Last round fixed without confirmatory full review, or majors remain → needs human.

## Metrics marker (every full round)

```text
<!-- ops-metrics:review {"change":"<change>","reviewType":"impl","round":<N>,"newMajors":<int>,"newMinors":<int>,"majorsFixed":<int>,"fixVerificationPassed":<bool>,"verdict":"continue|ready|needs_human"} -->
```

Counts only; no finding prose/source/tool output. Hidden marker is harmless when metrics are disabled. No telemetry tool/model call.

## Guardrails

- Not CODEOWNERS replacement. Not auto after ship; choose via `/ops-next` or run manually.
- Do **not** merge, force-push, open second PR, or re-ship only to re-trigger review.
