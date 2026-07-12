---
name: ops-impl-review
description: >
  Iterative implementation quality gate after ship and before merge. Reviews code
  vs specs/tasks/diff/tests, fixes majors, commits+pushes to PR branch, re-reviews
  until clean or max rounds. Use /ops-impl-review. Not human PR approve/merge.
license: MIT
compatibility: openspec-ops where, gh optional for PR diff, project tests
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-impl-review

**Post-ship implementation quality gate** (code vs OpenSpec plan).  
Runs **after** `openspec-ops ship` / `/ops-ship` and **before** human merge.

**Not** a substitute for CODEOWNERS / human approve. **Does not** merge or `gh pr review approve`.

## Behavior: review → fix → push → re-review

1. Resolve change worktree: `openspec-ops where "<change>" --json` → `result.path` as cwd.
2. Prefer PR context: `gh pr view` / `gh pr diff` for head = change branch; else `git diff` vs base (`main` / origin default).
3. Loop up to **max rounds** (config below):
   - Read relevant **specs** + **tasks.md**
   - Review **diff** for alignment with requirements/scenarios
   - Run project tests when available (`npm test` / `package.json` `scripts.test`); **non-zero = major**
   - If **no major** → verdict **ready for human merge**; stop
   - Else: edit **implementation** (and honest task checkboxes if falsely checked)
   - If dirty: `git add` + commit message like `fix(impl-review): <change> round N`
   - **`git push`** to existing remote branch (**no `--force`**); **do not** open a second PR; **do not** re-run `ship` just to re-arm auto
   - Re-review
4. If majors remain after max rounds → **needs human**

**Minor alone does not force another round.** Uncertain → minor.

### Major checklist (examples)

- Main scenario not implemented
- Tasks checked but behavior/files missing
- **Test failure**
- Contradicts non-goals
- Obvious break in touched code

## Config

- `/ops-config set impl-review.max-rounds N` or env `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS`
- Default **3**; session > env > default (injected config lines)

## Guardrails

- No force push; no merge; no approve-as-authority
- Do not expand product scope beyond the change
- Submodule detached+dirty: treat as major / fix like ship guidance
- Primary path assumes **post-ship PR**; if no PR, say so and prefer ship first
