---
name: ops-spec-review
description: >
  Iterative OpenSpec plan/spec quality gate after propose and before apply.
  Reviews proposal/design/specs/tasks, fixes major findings in artifacts, re-reviews
  until clean or max rounds. Use /ops-spec-review. Not code or PR review.
  Refuses archived / wrong-phase changes unless historical override.
license: MIT
compatibility: openspec CLI + openspec-ops where; Pi session config via /ops-config
metadata:
  author: openspec-ops
  version: "0.2.0"
---

# ops-spec-review

**OpenSpec plan/spec quality gate** (proposal · design · specs · tasks).  
**Not** application code review. **Not** GitHub PR review.

Runs **after** `/opsx-propose` and **before** `/opsx-apply` only.

## Phase check (do this first)

1. Resolve roots: worktree path from `openspec-ops where` (if any) + primary/`openspec status` roots.
2. Detect phase (helper logic: active `openspec/changes/<name>/` vs `openspec/changes/archive/*-<name>/` or `YYYY-MM-DD-<name>`):
   - **`archived`** (archive exists, no active dir): **STOP**. Print  
     `Phase mismatch: ops-spec-review is pre-apply. Change appears archived. Skipping fix rounds.`  
     Do **not** edit artifacts. Suggest: do not re-propose; use mainline specs / human merge path.
   - **`active_and_archived`** (split-brain): **STOP** the pre-apply fix loop. Print phase mismatch + split-brain; run or suggest `openspec-ops doctor`. Do not “fix” plan as if pre-apply.
   - **`ok`**: continue.
3. **Override** only if user explicitly asked for historical re-review / force / override phase — then you MAY proceed with a one-shot audit (still prefer not to expand scope).

Optional soft warn: if all tasks are `[x]` and context says already shipped/applied, warn and prefer stop unless user insists.

Auto-review (`OPENSPEC_OPS_AUTO_REVIEW`) only arms after **propose** — never because of archive/ship.

## Behavior: review → fix → re-review

Only after phase check allows:

1. Resolve change (worktree-aligned).
2. Loop up to **max rounds** (see Config):
   - Review artifacts; classify **major** vs **minor**
   - If **no major** → stop with **ready for apply** (list residual minors)
   - Else **edit artifacts only** under the change root to fix majors (minimal; no scope expand; no product `src/` implementation)
   - Re-review
3. If majors remain after max rounds → **needs human** with remaining majors.

**Minor findings alone must not force another round.**  
If unsure whether something is major → treat as **minor**.

### Major checklist (examples)

- Capability in proposal missing matching `specs/<name>/`
- Requirement without scenario
- Tasks miss main requirement path
- Contradicts stated non-goals / scope
- Unimplementable or empty SHALL

### Minor (do not loop solely for these)

- Wording, ordering, polish, optional docs nits

## Config (max rounds)

Precedence: **Pi session `/ops-config`** > env `OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS` > **default 3**.

- Prefer values injected as `openspec-ops config (effective…)` / `max rounds = N (source=…)`.
- Or: `/ops-config set spec-review.max-rounds 5`
- No project config file. Session values reset when Pi restarts.

Clamp is 1–10 when set via ops-config.

## Resolve change location

1. `openspec-ops where "<change>" --json` → on success use `result.path`; prefer `W/openspec/changes/<change>/`
2. Else `openspec status --change "<change>" --json` → `changeRoot` / `artifactPaths`
3. Also consider primary checkout for phase scan (active vs archive)
4. If missing entirely → stop with not found

**ensure/start does not chdir** — read/write under the resolved change directory.

## Input

- **Required:** change name (kebab-case)
- Optional: max-rounds; **historical / force** override for archived audit

## Output each run

Report:

```text
Phase: ok | archived | active_and_archived
Rounds used: k / max
Fixes applied: …
Residual minors: …
Verdict: ready for apply | needs human | phase_mismatch
```

## Guardrails

- Edit **only** change artifacts (proposal, design, specs, tasks) when phase is ok (or explicit override).
- Do **not** expand product scope to “pass” review.
- Do **not** implement application code as part of this skill.
- Do **not** merge, ship, finish, or archive.
- Do **not** re-run full fix loops on archived changes without override.
- Auto-review follow-up uses this skill after **propose only**; users may set `OPENSPEC_OPS_AUTO_REVIEW=off`.
