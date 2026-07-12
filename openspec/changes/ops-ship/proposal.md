## Why

After apply, operators still hand-roll `git add/commit/push` and open a PR. openspec-ops already owns worktree identity (`where`/`start`) and refuses to ship inside `finish`, so the gap is a **dedicated ship path**: commit the change worktree and open a PR without auto-merge or forking OpenSpec.

## What Changes

- Add CLI `openspec-ops ship <change>` that, for a registered change worktree:
  1. Commits **all** worktree changes (full tree; option A)
  2. Pushes the change branch to `origin` (or configured remote)
  3. Opens a pull request via a **pluggable PR backend** (v1: **GitHub `gh`**)
- Add Pi skill/prompt `ops-ship` / `/ops-ship` (ops-* package surface only).
- Document ship in the recommended loop: apply → **ship** → review/merge → archive → finish.
- Policy env `OPENSPEC_OPS_AUTO_SHIP` (`off`|`ask`|`on`) for any future harness auto-arm; CLI remains explicit.
- **No** auto-merge into main; **no** finish auto-commit; **no** archive changes.

## Capabilities

### New Capabilities
- `ops-ship`: Commit entire change worktree, push branch, open PR via pluggable backend (default `gh`).

### Modified Capabilities
- `workspace-lifecycle`: Add `ship` command to lifecycle surface (JSON schemaVersion 1 envelope; new command name).
- `pi-ops-skills`: Add ops-ship skill/prompt pair and README mapping.
- `worktree-loop-closure` (or docs-only delta via ship docs): Document ship step before merge in default loop.
- `worktree-submodule-hygiene`: Ship preflight **aborts** on detached+dirty top-level submodules; clean detached may warn and continue.

## Impact

- Code: new `src/commands/ship.ts`, PR backend interface + `gh` adapter, CLI wiring, types, tests, package `pi.skills`/`pi.prompts` if applicable.
- Workflow: agents can complete apply → ship without leaving the worktree model.
- Non-impact: OpenSpec archive semantics; finish dirty/force rules; auto-merge; default force-push.
