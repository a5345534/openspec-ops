# Change: ops-next-pr-signals

## Why

`/ops-next` station detection accepts `hasOpenPr` / `hasMergedPr`, but the Pi extension **hardcodes both to `false`**. After ship (open PR) or merge, station stays `applied` when tasks are complete, so the menu only offers **ship** again—not impl-review / merge / archive. This is a functional bug in guided lifecycle.

## What Changes

- Wire PR signals into `/ops-next` (and any shared signal-builder used by the extension):
  - `hasOpenPr` via existing `findOpenPullRequest` (or soft wrapper)
  - `hasMergedPr` via existing merge-status backend `findMergedPullRequest`
- Use change branch from `where` when available, else default branch = change name
- Use primary or worktree cwd suitable for `gh`
- **Fail-open:** if `gh` missing/fails, leave flags false and optionally notify once; do not crash `/ops-next`
- Unit tests for signal helper; station tests already cover true flags
- Brief skill/README note that station uses PR state when `gh` available

## Capabilities

### Modified Capabilities

- `guided-next-step`: station detection for shipped/merged MUST use real PR signals when available (not hardcoded false)

## Impact

- Extension + small `src/next-step` helper
- Requires `gh` for accurate shipped/merged; without gh, behavior remains conservative (applied)

## Non-goals

- Changing hard-coded edge tables
- Caching PR state across sessions
- New CLI command
