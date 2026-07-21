## Why

Operators who set `finish.return-to-main=required` in multi-submodule monorepos often hard-stop on `return_to_main_needs_human` / `incompatible_default` after merge and worktree removal already succeeded. They want automatic primary pull without requiring every submodule to attach to a default branch tip that matches the parent gitlink. Issue #44 proposed a `primary-only` policy granularity.

## What Changes

- Extend `finish.return-to-main` policy values from `off|required` to **`off|primary-only|required`**.
- Effective `primary-only` causes `/ops-deliver` / finish skill to pass **`--sync-primary --sync-submodules`** (ff primary + recursive submodule update to gitlink pins) and **not** `--return-to-main` / attach.
- Effective `required` keeps strict `--return-to-main` (including attach).
- Effective `off` still passes no sync flags by default.
- Update config injection, admin menu choices, README, ops-config / ops-deliver / ops-finish specs and skills.
- Document that detached @ gitlink after submodule update is the intended monorepo sync state.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `ops-config`: accept and document `primary-only` for `finish.return-to-main`.
- `ops-deliver`: map `primary-only` to primary+submodule sync flags without strict return-to-main.
- `finish-closeout` / `primary-closeout-sync` (docs + skill behavior only if needed): clarify primary-only mapping; CLI flags already exist.

## Impact

- `src/pi-config/store.ts`, admin menus, extension injection text
- `.pi/skills/ops-deliver`, `.pi/skills/ops-finish`, prompts if any
- README, tests (`pi-config`, package-export-surface)
- User preference may be set to `primary-only` after ship
