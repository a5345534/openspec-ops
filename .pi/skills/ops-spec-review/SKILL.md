---
name: ops-spec-review
description: >
  Iterative OpenSpec plan/spec quality gate after propose and before apply.
  Each round is a full review; fix verification is in-round; after fixes another
  full review is required before ready (max full-review rounds). Use /ops-spec-review.
  Not code or PR review. Refuses archived / wrong-phase unless historical override.
license: MIT
compatibility: openspec CLI + openspec-ops where; Pi session config via /ops-config
metadata:
  author: openspec-ops
  version: "0.2.0"
---

# ops-spec-review

## Response language

Follow the injected `REQUIRED RESPONSE LANGUAGE` for all progress, findings, verdicts, hard stops, and summaries. English examples are structural templates: translate their natural-language meaning while preserving commands, paths, identifiers, error codes, JSON keys, URLs, and metrics markers exactly.

**OpenSpec plan/spec quality gate** (proposal · design · specs · tasks).  
**Not** application code review. **Not** GitHub PR review.

Runs **after** `/opsx-propose` and **before** `/opsx-apply` only.

## Runtime binding

For `openspec-ops where`/doctor preflight, use a valid extension-bound exact executable path from current agent context first (safely quoted; never concatenated into `sh -c`). Without a binding, use `OPENSPEC_OPS_BIN`, then PATH, or continue with `openspec status` only where the documented fallback permits; never replace the CLI with raw worktree Git.

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

Auto-review is **removed**. Run this skill manually or choose it via `/ops-next`.

## Behavior: full review rounds (not verify-as-round)

Only after phase check allows:

1. Resolve change (worktree-aligned).
2. Loop up to **max full-review rounds** (see Config). **One round = one full review** of current proposal/design/specs/tasks.

   At the start of each full round, emit this hidden metadata-only comment (exact compact JSON):

   ```text
   <!-- ops-metrics:stage {"change":"<change>","action":"ops-spec-review","round":<N>} -->
   ```

   **Each full review MUST:**
   - Re-read current artifacts as a whole (not only the previous major list)
   - Classify **major** vs **minor** (prior majors MAY be extra checks, not a scope ceiling)
   - Prefer `openspec validate <change>` when available; non-zero → **major**

   **Then:**
   - If **zero majors** → stop **ready for apply** (list residual minors). Do **not** invent another round.
   - If **majors** and rounds remain:
     1. **Fix** artifacts only (change root; minimal; no product `src/`)
     2. **In-round verify** those fixes landed (same round; NOT a separate review round)
     3. If full-review rounds still remain → **start another full review round** (step 2).  
        Do **not** declare ready solely because in-round verify passed.
   - If majors remain and no full-review rounds remain (including: last round fixed majors but no confirmatory full review left) → **needs human** (list majors / “pending confirmatory full review; re-run /ops-spec-review”).

3. **Forbidden:** labeling a verify-only pass as “Round N”; using Round N only to check previous fixes.

**Minor findings alone must not force another full review round.**  
If unsure whether something is major → treat as **minor**.

### Metrics result marker (every full round)

At the end of **each** full review round, emit one hidden comment with counts only (no finding prose):

```text
<!-- ops-metrics:review {"change":"<change>","reviewType":"spec","round":<N>,"newMajors":<int>,"newMinors":<int>,"majorsFixed":<int>,"fixVerificationPassed":<bool>,"verdict":"continue|ready|needs_human"} -->
```

- `continue`: majors were handled/in-round verified and another full round will run.
- `ready`: the full review found zero majors.
- `needs_human`: round budget ended with majors or pending confirmatory full review.
- `fixVerificationPassed=true` when no fixes were needed or required fixes verified; false when verification failed/pending.
- Marker is harmless when local metrics are disabled. Never call a telemetry tool/model; never put finding text, prompt/source/tool content, or errors in it.

### Major checklist (examples)

- Capability in proposal missing matching `specs/<name>/`
- Requirement without scenario
- Tasks miss main requirement path
- Contradicts stated non-goals / scope
- Unimplementable or empty SHALL
- `openspec validate` fails (when run)

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
Round 1 (full review)
  Majors: …
  Minors: …
  In-round fix+verify: none | cleared | failed
  Metrics: emit one structured review marker
Round 2 (full review)   # only if needed after fixes or further issues
  Majors: none
  Residual minors: …
Rounds used: k / max   # k = number of full reviews only
Verdict: ready for apply | needs human | phase_mismatch
```

Do **not** invent a round whose only content is “verified previous fixes.”

## Guardrails

- Edit **only** change artifacts (proposal, design, specs, tasks) when phase is ok (or explicit override).
- Do **not** expand product scope to “pass” review.
- Do **not** implement application code as part of this skill.
- Do **not** merge, ship, finish, or archive.
- Do **not** re-run full fix loops on archived changes without override.
- Prefer `/ops-next` after propose to choose spec-review; no automatic follow-up turn.
