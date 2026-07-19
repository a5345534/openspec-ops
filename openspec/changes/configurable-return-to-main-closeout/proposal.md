## Why

A successful `/ops-deliver` currently closes the change worktree but intentionally leaves the primary checkout and submodules untouched unless the operator remembers three one-shot `finish` flags. In multi-repository workspaces this repeatedly leaves an apparently completed lifecycle behind remote mainline with detached submodules, so operators need a safe configurable Definition of Done.

## What Changes

- Add a session/environment-resolved `finish.return-to-main` policy with `off` as the non-mutating default and `required` as an explicit opt-in.
- Make `/ops-deliver` honor `required` at its final finish station without requiring repeated manual flags.
- Add a composite strict return-to-main finish path that synchronizes the clean primary ff-only, updates submodule pins, and attaches eligible submodules to resolved remote default branches without force/reset/history rewrite.
- Fail closed with structured diagnostics when primary or submodule state cannot satisfy both the remote default branch and the superproject gitlink.
- Report final primary and per-submodule closeout state in JSON while retaining the existing non-mutating default.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ops-config`: Add the return-to-main policy key, validation, precedence, and injected effective value.
- `ops-deliver`: Apply the configured closeout policy automatically at finish while preserving the default-off behavior.
- `primary-closeout-sync`: Add strict composite synchronization, remote-default branch resolution, fail-closed safety, and structured final-state diagnostics.
- `pi-ops-skills`: Teach packaged lifecycle instructions how to consume the effective closeout policy safely.

## Impact

Affected areas include `src/pi-config`, finish CLI parsing/types, `src/commands/finish-sync.ts`, `src/commands/finish.ts`, the guided extension config injection, packaged ops skills, README documentation, and lifecycle/finish/config tests. No new external dependency or network service is introduced; Git fetch/pull operations remain explicit opt-in behavior.
