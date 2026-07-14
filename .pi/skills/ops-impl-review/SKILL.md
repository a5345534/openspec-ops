---
name: ops-impl-review
description: >
  Post-ship implementation quality gate: full-review rounds of code vs
  specs/tasks/diff/tests; fix+push with in-round verify; after fixes another
  full review before ready (max full-review rounds). Use /ops-impl-review.
  Not human PR approve/merge.
license: MIT
compatibility: openspec-ops where, gh optional for PR diff, project tests
metadata:
  author: openspec-ops
  version: "0.2.0"
---

# ops-impl-review

**Post-ship implementation quality gate** (code vs OpenSpec plan).  
Runs **after** `openspec-ops ship` / `/ops-ship` and **before** human merge.

**Not** a substitute for CODEOWNERS / human approve. **Does not** merge or `gh pr review approve`.

## Runtime binding

For `openspec-ops where` and other CLI preflight, use a valid extension-bound exact executable path from current agent context first (safely quoted; never concatenated into `sh -c`). Without a binding, use `OPENSPEC_OPS_BIN`, then PATH, or hard-stop if the required CLI cannot be resolved.

## Behavior: full review rounds (not verify-as-round)

1. Resolve change worktree: `openspec-ops where "<change>" --json` → `result.path` as cwd.
2. Prefer PR context: `gh pr view` / `gh pr diff` for head = change branch; else `git diff` vs base (`main` / origin default).
3. Loop up to **max full-review rounds** (config below). **One round = one full review.**

   At the start of each full round, emit this hidden metadata-only comment (exact compact JSON):

   ```text
   <!-- ops-metrics:stage {"change":"<change>","action":"ops-impl-review","round":<N>} -->
   ```

   **Each full review MUST:**
   - Read relevant **specs** + **tasks.md**
   - Review **current** implementation / diff for alignment with requirements/scenarios (whole change state—not only files from the previous fix list; prior majors MAY be extra checks, not a scope ceiling)
   - Run project tests when available (`npm test` / `package.json` `scripts.test`); **non-zero = major**

   **Then:**
   - If **zero majors** → verdict **ready for human merge**; stop. Do **not** invent another round.
   - If **majors** and full-review rounds remain:
     1. Edit **implementation** (and honest task checkboxes if falsely checked)
     2. If dirty: `git add` + commit like `fix(impl-review): <change> round N`
     3. **`git push`** to existing remote branch (**no `--force`**); no second PR; do not re-run `ship` only to re-trigger review
     4. **In-round verify** (same round; NOT a separate review round): re-run tests; confirm this round’s majors are addressed
     5. If full-review rounds still remain → **another full review** (step 3).  
        Do **not** declare ready solely because post-push tests passed / in-round verify passed.
   - If majors remain and no full-review rounds remain (including: last round fixed majors but no confirmatory full review left) → **needs human** (list majors / “pending confirmatory full review; re-run /ops-impl-review”).

4. **Forbidden:** labeling a verify-only or “re-ran tests after push” pass as “Round N”; using Round N only to check previous fixes.

**Minor alone does not force another full review round.** Uncertain → minor.

### Metrics result marker (every full round)

At the end of **each** full review round, emit one hidden comment with counts only (no finding prose):

```text
<!-- ops-metrics:review {"change":"<change>","reviewType":"impl","round":<N>,"newMajors":<int>,"newMinors":<int>,"majorsFixed":<int>,"fixVerificationPassed":<bool>,"verdict":"continue|ready|needs_human"} -->
```

- `continue`: majors were handled/pushed/in-round verified and another full round will run.
- `ready`: the full review found zero majors.
- `needs_human`: round budget ended with majors or pending confirmatory full review.
- `fixVerificationPassed=true` when no fixes were needed or required fixes verified; false when verification failed/pending.
- Marker is harmless when local metrics are disabled. Never call a telemetry tool/model; never put finding text, prompt/source/tool content, or errors in it.

### Major checklist (examples)

- Main scenario not implemented
- Tasks checked but behavior/files missing
- **Test failure**
- Contradicts non-goals
- Obvious break in touched code

## Config

- `/ops-config set impl-review.max-rounds N` or env `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS`
- Default **3** **full-review** rounds; session > env > default (injected config lines)

## Output

```text
Round 1 (full review)
  Majors: …
  In-round fix+push+verify: none | cleared | failed
  Metrics: emit one structured review marker
Round 2 (full review)   # only if needed after fixes
  Majors: none
Rounds used: k / max   # full reviews only
Verdict: ready for human merge | needs human
```

Do **not** invent a round whose only content is “tests green after push.”

## Guardrails

- No force push; no merge; no approve-as-authority
- Do not expand product scope beyond the change
- Submodule detached+dirty: treat as major / fix like ship guidance
- Primary path assumes **post-ship PR**; if no PR, say so and prefer ship first

Merge only via `/ops-merge` when the user explicitly asks; this skill must not merge.
