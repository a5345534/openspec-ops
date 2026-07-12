# Change: ops-next-pick-change

## Why

`/ops-next` currently **requires** a kebab change name. With no argument it only prints usage and exits—operators cannot pick among active changes via Pi `ui.select`. After guided lifecycle removed auto chaining, `/ops-next` is the main station menu; missing “pick change first” makes the empty command feel broken.

## What Changes

- `/ops-next` with **no** change argument:
  1. Discover candidate changes (worktrees + active `openspec/changes/*`, exclude archive)
  2. If none → notify how to `/ops-start` / propose; stop
  3. If one → use it (optional confirm via select still OK)
  4. If many → `ctx.ui.select` (or text numbered list) to pick change
  5. Then existing next-step menu for that change
- `/ops-next <name>` unchanged (skip pick step)
- Headless: text list of changes, then text next-step menu; no silent auto-pick of “first” change unless only one candidate
- Skill/prompt/docs update

## Capabilities

### Modified Capabilities

- `guided-next-step`: nameless `/ops-next` discovers and selects a change before station menu
- `pi-ops-skills`: ops-next skill documents optional change arg and pick flow

## Impact

- Extension `ops-next` handler + small discovery helper (reuse doctor/where/fs patterns)
- No auto-run of lifecycle skills without explicit selection of action (and of change when multiple)

## Non-goals

- Picking archived-only changes by default
- Reintroducing auto-review/ensure
- Full TUI multi-page browser of all git branches
