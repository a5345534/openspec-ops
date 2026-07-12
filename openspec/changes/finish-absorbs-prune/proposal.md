## Why

Closeout today is **archive → finish → prune**. Finish only removes the worktree and **always keeps the branch**; prune separately deletes local+remote branches only when the PR is merged. Operators experience prune as redundant noise, while agents often delete branches ad hoc. Folding **merged-only branch cleanup into finish** shortens the loop to **archive → finish** and retires prune as a required step—without making finish delete branches when the PR is not merged.

## What Changes

- Extend **`openspec-ops finish`**:
  1. Remove worktree when present (existing dirty/`--force` + submodule deinit)
  2. Unless `--keep-branch`: if gh reports a **merged** PR for the change branch, delete **local** (`-d` only) and **remote** (default `origin`) branches—same safety as today’s prune
  3. If PR not merged: keep branch; report `keptReason: not_merged`
  4. If **no worktree**: still allow finish to perform **branch-only** cleanup when merged (`pruned_only` / equivalent)
  5. `--force` only relaxes dirty worktree removal—**never** allows deleting an unmerged branch
- Enrich finish JSON (`worktreeRemoved`, branch delete flags, `branchDeleted` compatibility)
- **Deprecate `prune`**: implement as thin wrapper around shared branch-delete core, or document “use finish”; plan eventual removal
- Update README/skills: loop ends at finish; ops-prune → finish; auto-finish uses enhanced finish
- Update specs that currently require finish to keep branch always / prune as sole branch deleter

## Capabilities

### New Capabilities
- `finish-closeout`: Finish is full closeout—worktree reclaim plus merged-PR branch cleanup (local+remote), replacing the need for a separate prune step.

### Modified Capabilities
- `workspace-lifecycle`: **Modify** finish requirements that currently forbid all branch deletion; add merged cleanup, `--keep-branch`, missing-worktree path, result shape.
- `ops-prune`: Deprecate in favor of finish (wrapper or docs + skill redirect).
- `pi-ops-skills`: ops-finish documents branch cleanup; ops-prune redirects.
- `worktree-loop-closure`: Loop is archive → finish (no required prune).
- `pi-auto-finish-on-archive`: Auto-finish invokes enhanced finish (may delete merged branches).

## Impact

- `finish.ts`, shared branch-delete helper (extract from prune), types, CLI flags, skills, README, tests
- Simpler closeout; auto-finish more complete after archive when PR already merged
- Risk: surprise branch delete after merge—mitigated by merged-only gate + `--keep-branch` + docs
- Non-impact: no merge/archive inside finish; no force-delete unmerged (`-D`); no bulk delete all branches
