## Context

Locked decisions:

| Topic | Choice |
|---|---|
| Name | `ops-impl-review` |
| Timing | **After ship**, before merge |
| Fix + push | **Yes** (PR exists → push; re-ship only if needed) |
| Tests | **Yes** — red tests = major |
| Auto after ship | **Yes**, default **on** (`OPENSPEC_OPS_AUTO_IMPL_REVIEW`) |
| Max rounds | Default 3; `/ops-config set impl-review.max-rounds` + env |
| Parallel multi-model | Out |

Mirror of `ops-spec-review`, but edits **product code** (and tests), not only plan artifacts.

## Goals / Non-Goals

**Goals:**
- Single-session iterative impl review against specs/tasks/diff/tests.
- Direct code fixes + push to PR branch within max rounds.
- Auto follow-up after successful ship (default on), disable with env/off.
- Config via existing ops-config session store (no project config files).

**Non-Goals:**
- Multi-model fan-out.
- `gh pr review approve` / merge automation.
- Replacing human review.
- Running before ship as the primary documented path (manual pre-ship allowed later if needed, not v1 focus).
- Mechanical `openspec-ops impl-review` CLI that replaces the skill body.

## Decisions

### D1 — Skill loop

```text
/ops-impl-review <change>

resolve where → worktree W, branch B
require or prefer: PR exists for B (gh) after ship
maxRounds = config impl-review.max-rounds (session > env > 3)

for round in 1..maxRounds:
  read relevant specs + tasks.md
  collect diff: gh pr diff and/or git diff base...HEAD in W
  run project tests (e.g. npm test) in W when available
  classify findings major | minor
  if no major:
    verdict: ready for human merge
    stop
  edit implementation (+ fix false task checkmarks if needed)
  commit if dirty?  — see D3
  push to remote B (no force)
  re-review
if majors remain:
  verdict: needs human
```

**Major examples:** main scenario unimplemented; tasks checked but missing behavior; **test failure**; contradicts non-goals; security-obvious break in touched code.  
**Minor:** style, nits; uncertain → minor.

### D2 — Diff and PR context

- Prefer `gh pr diff` / `gh pr view` for head = change branch when PR exists.
- Fallback: `git diff origin/main...HEAD` or resolved base from ship defaults.
- If no PR and user still runs manually: review worktree vs base; push may create need to ship first — skill should say **primary path assumes post-ship PR**.

### D3 — Commit vs push after fixes

- If worktree dirty after fixes: create commit (message e.g. `fix(impl-review): <change> round N`) then `git push` (no force).
- Reuse patterns from ship where sensible, but **do not** open a second PR if one exists.
- If push fails: surface error; do not force.

### D4 — Tests

- Detect and run standard test script when present (`npm test` / package.json scripts.test).
- Non-zero exit → major finding for that round.
- If no test script: note as residual risk (minor or info), do not invent a full suite.

### D5 — Config

| Key | Env | Default |
|---|---|---|
| `impl-review.max-rounds` | `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS` | 3 |

Clamp 1–10 like spec-review. Extend `KNOWN_KEYS` in `src/pi-config/store.ts`. Inject via existing formatConfigInjection.

### D6 — Auto after ship (v1 locked: skill-level)

| Env | Default | Behavior |
|---|---|---|
| `OPENSPEC_OPS_AUTO_IMPL_REVIEW` | **on** | After **successful** ship, agent **must** continue with `/ops-impl-review <change>` when policy on |

**v1 arming = ops-ship skill/prompt contract only** (ship is CLI; extension does not parse ship JSON in v1):

1. After successful `openspec-ops ship … --json`, if `parseAutoImplReviewPolicy` is not `off`, the agent runs `/ops-impl-review <change>` in the same session or as the immediate next step.
2. Policy helper `parseAutoImplReviewPolicy` default **on** (`on`|`off`, case-insensitive; unset → on).
3. **No extension follow-up required** for v1 (optional later). Task 2.3 remains optional no-op unless free.

**Anti-loop:** Impl-review **must not** invoke ship again solely to re-trigger auto impl-review. After fixes it **pushes** only. A new explicit user `ship` may run impl-review again.

Document risk: default **on** means post-ship code edit + push without extra confirm.

### D7 — Safety

- No `--force` push.
- No merge/approve.
- Max rounds cap thrashing.
- Dirty submodule detached: same caution as ship (abort or major).
- Document: default auto **on** means post-ship code edits + push may happen without extra confirm (user can set off).

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Auto edits production branch | Default on by request; off switch; max rounds |
| Infinite ship↔review | Do not auto-ship from impl-review; only push |
| Flaky tests → infinite major | max rounds; flaky → needs human |
| Large diffs exceed context | Focus on changed files + specs cited by tasks |

## Open Questions (resolved)

| Q | Decision |
|---|---|
| Timing | After ship |
| Push after fix | Yes |
| Tests | Required when available; red = major |
| Auto | Yes, default on |
| Max rounds | 3, configurable |

## Implementation sketch

```text
.pi/skills/ops-impl-review/SKILL.md
.pi/prompts/ops-impl-review.md
src/pi-config/store.ts          # impl-review.max-rounds
src/auto-impl-review/policy.ts  # parse AUTO_IMPL_REVIEW default on
.pi/skills/ops-ship/            # post-success → ops-impl-review when on
README loop + config docs
tests: policy default on; config key
```
