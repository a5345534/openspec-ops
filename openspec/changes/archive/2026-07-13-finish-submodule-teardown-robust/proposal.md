## Why

Issue #22 (P1): `openspec-ops finish` can fail with `submodule_teardown_failed` **after** `git submodule deinit` succeeds, because residual submodule directories (or incomplete deinit cleanup) still make `git worktree remove` refuse with “contains submodules” (including Chinese locale messages already matched).

That hard-stops `/ops-deliver` at the last station and forces manual deinit / empty-dir / force rituals.

## What Changes

- Harden `prepareWorktreeForRemoval`: after successful deinit, **clear residual top-level submodule work dirs** when they no longer look initialized (safe post-deinit leftovers).
- Harden `runFinish` remove path: on submodule **containment** error after first remove, **re-prepare once and retry** `worktree remove` once before failing.
- Keep `submodule_teardown_failed` + actionable hint if still blocked.
- Regression tests for residual-dir cleanup + finish retry.
- Spec delta under `finish-submodule-teardown`.

## Capabilities

### Modified Capabilities

- `finish-submodule-teardown`: robust prepare + single retry on containment

## Non-goals

- Pruning submodule feature branches / remotes (issue #22 P2)
- Nested submodules beyond top-level `.gitmodules` paths
- Auto-pull primary after merge
- Changing dirty/`--force` policy
