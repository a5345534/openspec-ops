# Design: impl-review-round-semantics

Mirror `spec-review-round-semantics` for post-ship code review.

## State machine

```text
round := 0
loop:
  if round >= max: needs_human if unresolved else ready
  round += 1   # full review only
  FULL_REVIEW:
    specs + tasks + diff/PR + tests (fail = major)
  if majors empty: ready_for_human_merge; stop
  FIX implementation (+ honest task checkboxes)
  commit + push (no force) if dirty
  IN_ROUND_VERIFY:
    re-run tests; confirm this round's majors addressed
    (NOT counted as a review round)
  if verify fails: re-fix once or leave majors for next full / human
  if rounds remain: continue  # next FULL_REVIEW
  else: needs_human (pending confirmatory full review)
```

## Counting

| Activity | +1 full-review round? |
|---|---|
| Full review (diff/specs/tests) | **Yes** |
| Fix + commit + push | No |
| In-round verify (tests + check majors) | No |

## Ready

Ready **iff** a full review returns zero majors.  
Tests green after push alone is **not** ready without that full review result.

## Output template

```text
Round 1 (full review)
  Majors: …
  In-round fix+push+verify: cleared | failed | none
Round 2 (full review)
  Majors: none
Verdict: ready for human merge | needs human
Rounds used: k / max  # full reviews only
```

## Files

- `.pi/skills/ops-impl-review/SKILL.md`
- `.pi/prompts/ops-impl-review.md` if present
- delta + main `openspec/specs/ops-impl-review/spec.md`
- `pi-ops-skills` ADDED skill-docs requirement
