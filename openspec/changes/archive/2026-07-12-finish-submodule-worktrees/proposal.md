## Why

`openspec-ops finish` fails with bare `git_failed` when the change worktree contains **initialized git submodules**. Git refuses `worktree remove` with “cannot move or remove a worktree that contains submodules.” `--force` does not help. Monorepos (e.g. AOS parent + `aos-core`) hit this on every closeout after ship/archive, blocking finish → prune. Issue: https://github.com/a5345534/openspec-ops/issues/3

## What Changes

- Make **finish submodule-aware** before `git worktree remove`:
  - Probe top-level submodules under the change worktree (reuse `src/submodules/probe`)
  - Deinitialize/unload initialized submodules from inside the worktree (e.g. `git submodule deinit -f -- <path>`) when safe under existing dirty/`--force` rules
  - Then remove the worktree as today; **branch kept**
- Improve errors: dedicated code/hint when submodule teardown or submodule-containing remove fails (not only opaque `git_failed`)
- Document finish closeout for submodule worktrees in help/README
- Tests: clean worktree + initialized top-level submodule → finish succeeds

## Capabilities

### New Capabilities
- `finish-submodule-teardown`: Finish tears down worktrees that contain initialized top-level submodules without requiring manual `submodule deinit`.

### Modified Capabilities
- `workspace-lifecycle`: Finish success path includes submodule unload before worktree remove; error taxonomy for submodule teardown failures.
- `worktree-submodule-hygiene`: Align finish teardown with existing probe/dirty messaging (docs/error hints).

## Impact

- `src/commands/finish.ts`, possibly `src/git.ts` / small teardown helper, types for error codes, README/finish help, tests
- Unblocks monorepo closeout; no change to OpenSpec archive or ship merge semantics
- Non-goals: recursive deep nested submodule graphs beyond top-level; auto-commit; changing dirty/`--force` consent model beyond making force work after deinit when git requires it for remove only
