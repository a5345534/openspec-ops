## Why

After merge, operators still hand-delete local and remote change branches. `finish` intentionally keeps the branch (`branchDeleted: false`); `ship` never merges or deletes. Without a safe, explicit cleanup command, merged change branches accumulate. Deletion must be gated on **PR merged** (not local `git branch --merged`) so squash merges are handled correctly, and must never run while a worktree still uses the branch.

## What Changes

- Add CLI `openspec-ops prune <change>` that, for a **single named change**:
  1. Refuses if a registered worktree for that change still exists (finish first)
  2. Confirms via PR backend (v1: **GitHub `gh`**) that a PR with head = change branch is **merged**
  3. Deletes the **local** branch and the **remote** branch (default remote `origin`)
  4. Refuses when no merged PR is found — **no force-delete of unmerged branches**
- Add Pi skill/prompt `ops-prune` (ops-* package surface).
- Document prune after finish in the recommended loop.
- **Do not** change finish defaults; **do not** auto-prune on archive/ship; **no** `--all` bulk mode in v1.

## Capabilities

### New Capabilities
- `ops-prune`: Safe deletion of local+remote change branches only when the corresponding PR is merged and no worktree remains.

### Modified Capabilities
- `workspace-lifecycle`: Add `prune` command to CLI surface (schemaVersion 1 JSON).
- `pi-ops-skills`: ops-prune skill/prompt pair.
- `worktree-loop-closure`: Document optional prune after finish.

## Impact

- Code: `src/commands/prune.ts`, PR merge-status query on gh backend (reuse/extend ship PR backend patterns), CLI/types, tests, README, ops-prune skill.
- Workflow: finish → (optional) prune after GitHub merge.
- Non-impact: finish still keeps branch by default; no auto-merge; no OpenSpec archive changes; no bulk prune of unrelated branches.
