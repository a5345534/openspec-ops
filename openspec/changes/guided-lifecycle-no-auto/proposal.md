# Change: guided-lifecycle-no-auto

## Why

Automatic cross-step lifecycle behavior (auto-ensure, auto-review, auto-impl-review, auto-finish) creates surprise follow-up turns, fights pre-apply phase gates, and cannot be “turned off enough” by env defaults—the machinery still exists. Operators want **explicit station control**: after each lifecycle step completes, choose the next step via harness UI (or text fallback). No background settle fires.

## What Changes

### Remove all auto lifecycle machinery (not merely default-off)

- Delete `src/auto-ensure`, `src/auto-review`, `src/auto-finish`, `src/auto-impl-review` and their tests.
- Remove `OPENSPEC_OPS_AUTO_START`, `OPENSPEC_OPS_AUTO_REVIEW`, `OPENSPEC_OPS_AUTO_FINISH`, `OPENSPEC_OPS_AUTO_IMPL_REVIEW` and doctor/README references.
- Strip Pi extension settle/input paths that ensure worktrees, schedule `/ops-spec-review`, or auto-finish orphans.
- Remove skill/prompt text that auto-chains impl-review after ship or implies auto-ensure on propose.
- Retire or clearly remove openspec-cli intercept auto-ensure behavior so no back-door start remains.
- Deprecate/remove main capability specs under `pi-auto-*` as applicable (delta REMOVED or supersession via new guided capability).

### Add guided next-step selection

- Hard-coded lifecycle **stations** and **legal edges** (no config file).
- After a step completes (skill/extension handoff), present next options:
  - Prefer Pi `ctx.ui.select` when `hasUI`
  - Else numbered text menu; **must not** auto-continue
- New entrypoint: `/ops-next` (skill + optional extension command) and shared pure logic for station detection + option lists.
- Skills end by invoking next-step guidance instead of silently starting the next skill.

### Edge policy (product decisions)

- **No ensure**: operators run `/ops-start` explicitly; propose does not auto-create worktrees.
- **In-step multi-round retained** for ops-spec-review and ops-impl-review (max-rounds unchanged).
- **`applied` → spec-review** not on main menu (invalid happy path).
- **`shipped`** may choose `impl-review`, **`ship` again**, or `merge`.
- **No auto-merge / auto-archive / auto-prune**; prune stays out of main path.
- Headless: print suggestions only; never `sendUserMessage` follow-up for the next skill without an explicit user choice in-session.

## Capabilities

### New Capabilities

- `guided-next-step`: station detection, hard-coded edges, UI select / text fallback, `/ops-next`, skill endings.

### Modified Capabilities

- `pi-ops-skills`: remove auto-chaining language; require next-step handoff after ship/archive/etc.
- `worktree-loop-closure`: documented loop is explicit stations + operator choice, not auto pipeline.
- `pi-auto-ensure-on-propose`, `pi-auto-review-follow-up`, `pi-auto-finish-on-archive`, `pi-auto-impl-review-follow-up`: **REMOVED** auto requirements (exact main headers); keep/adjust manual start/review/finish availability where needed.
- `openspec-cli-intercept`: **remove ensure-before-new-change**; any remaining shim is forward-only without worktree ensure.

## Impact

- Breaking: anyone relying on auto-ensure/review/finish/impl-review must use `/ops-start` and `/ops-next` (or raw slashes).
- Pi extension shrinks to guided next-step + optional workspace handoff text (no settle auto fire).
- README happy path rewritten.
- Package still ops-only for OpenSpec consumer skills; guided skills are ops-*.

## Non-goals

- Implementing a configurable workflow engine or DAG editor
- Changing merge checks policy, finish branch cleanup semantics, or review max-rounds defaults
- Auto-running start when user forgets (by design)
- Restoring prune as a required closeout step
