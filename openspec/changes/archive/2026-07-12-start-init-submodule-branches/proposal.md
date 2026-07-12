# Change: start-init-submodule-branches

## Why

Issue #2 Option C: after `openspec-ops start`, nested submodules often remain on **detached HEAD**. Agents implement there without a named branch, making push/PR and parent gitlink updates fragile. Probe/doctor (Option B) already surface the problem; operators need an **opt-in** way for start to create/switch submodule branches without auto-commit.

## What Changes

- `openspec-ops start <change> --init-submodule-branches` (opt-in, default off)
- For each **checked-out top-level** submodule under the change worktree that is detached:
  - if local branch named like the change branch exists → `git switch <branch>`
  - else → `git switch -c <branch>` at current HEAD
- **No** auto-commit, auto-push, or parent gitlink update
- Fail-open per submodule: failures become `warnings[]`, start still succeeds for the parent worktree
- Report actions on `StartResult` (e.g. `submoduleBranches`)
- Docs: ops-start skill + README; issue #2 can close when this lands

## Capabilities

### New Capabilities

- `start-submodule-branches`: opt-in init of named branches in detached top-level submodules at start

### Modified Capabilities

- `workspace-lifecycle`: start accepts `--init-submodule-branches` and may create submodule branches
- `worktree-submodule-hygiene`: document opt-in branch init path
- `pi-ops-skills`: ops-start documents the flag

## Impact

- CLI flag + start result shape
- No change to default start behavior without the flag

## Non-goals

- Recursive nested submodules beyond top-level
- Auto-commit / push
- Default-on init (remains opt-in)
- Subtree migration
