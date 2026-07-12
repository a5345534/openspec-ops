# Design: spec-review-round-semantics

## State machine

```text
round := 0
loop:
  if round >= max: break needs_human if unresolved majors else ready
  round += 1
  FULL_REVIEW current artifacts  → majors M, minors m
  if M empty:
    verdict ready_for_apply (residual m); stop
  FIX M (artifacts only)
  IN_ROUND_VERIFY M cleared on disk
  if verify fails:
    retry fix within round OR escalate (implementation: re-fix once, then if still fail count as remaining majors)
  # M was non-empty and we fixed: must full-review again if budget remains
  continue  # next iteration = another FULL_REVIEW, not verify-only
```

## Counting

| Activity | Counts as review round? |
|---|---|
| Full review | **Yes** (+1) |
| Fix | No |
| In-round verify of this round’s majors | No |
| Verify-only pass reported as “Round N” | **Forbidden** |

## Ready rules

1. **Ready** only when a **full review** returns zero majors (not when only in-round verify passes after fixes).
2. Therefore after fixes, **another full review round** is required before ready (if `round < max`).
3. If fixes happen in round == max and in-round verify passes but no full review left: **needs human** (or optionally allow ready if verify-only—**reject**; require human or note “last round fixed without trailing full review → needs human / re-run review”).

**Chosen:** If the last allowed full review found majors, agent fixes+verifies in-round, but cannot start another full review → **needs human** with note “fixed pending confirmatory full review; re-run /ops-spec-review”. Prefer not silent ready.

Simpler operator UX alternative: allow ready after in-round verify on last round if verify clean—**we reject** per operator intent (ready needs full review 0 major).

## Full review requirements

Each full review MUST:

- Re-read proposal, design, specs, tasks (current content)
- Apply major checklist to **whole** change, not only prior M list
- Prior M list may be used as extra checks, not scope ceiling
- Prefer run `openspec validate <change>` when CLI available; non-zero → major

## Output template

```text
Phase: ok
Round 1 (full review)
  Majors: ...
  Minors: ...
  In-round fix+verify: cleared / failed
Round 2 (full review)
  Majors: none
  Residual minors: ...
Verdict: ready for apply | needs human
Rounds used: 2 / 3
```

## Files to edit

- `.pi/skills/ops-spec-review/SKILL.md`
- `.pi/prompts/ops-spec-review.md` if present
- `openspec/specs/ops-spec-review/spec.md` via delta MODIFIED iterative loop requirement
