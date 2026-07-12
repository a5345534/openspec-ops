## Context

Locked decisions:

| Topic | Choice |
|---|---|
| Delete remote when merged | **Yes** (local + remote, like prune) |
| Finish without worktree | **Yes** (branch-only path when merged) |
| Replace prune | **Yes** (finish absorbs; prune deprecated) |
| Unmerged finish | Worktree only; **keep branch** |
| `--force` | Dirty worktree only; not unmerged branch delete |

Today: `runFinish` requires worktree via `locateWorkspace`; always `branchDeleted: false`. `runPrune` requires no worktree + merged PR.

## Goals / Non-Goals

**Goals:**
- Single closeout command after archive: finish.
- Reuse prune’s merged-PR gate and -d / push --delete semantics.
- Support wt present, wt absent, keep-branch, already clean.
- Deprecate prune without breaking callers in phase 1 (wrapper).

**Non-goals:**
- Auto `-D` on squash tip mismatch.
- Finish performing merge or archive.
- Bulk prune of all local branches.
- Immediate hard removal of prune CLI without wrapper period (phase 1 keeps alias).

## Decisions

### D1 — Finish algorithm

```text
finish <change> [--force] [--keep-branch] [--remote origin] [--json]

change, branch = defaults
ctx = resolveRepoContext
wt = try locateWorkspace; catch not_found → noWt

if wt exists:
  if dirty && !force → worktree_dirty
  prepareWorktreeForRemoval (submodule deinit)
  removeWorktree
  worktreeRemoved = true
else:
  worktreeRemoved = false

if keep-branch:
  skip branch delete; keptReason = keep_flag
else:
  merged = gh findMergedPr(head=branch)
  if !merged:
    keptReason = not_merged
  else:
    delete local (-d) if exists; remote if exists (same as prune)
    # failures: git_failed with hints; no -D

action =
  both wt removed and branch cleaned → removed_and_pruned
  only wt → removed
  only branch → pruned_only
  nothing to do → already_clean
```

### D2 — locateWorkspace when no worktree

Today finish throws `not_found` without wt. Change to:

- Prefer soft locate: if not_found, continue with branch-only path (still need valid change name / repo).
- Do not require start/worktree for merged branch cleanup.

### D3 — Shared core

Extract from prune:

```text
deleteMergedChangeBranches({ cwd, branch, remote, findMergedPr, ... })
```

Used by `runFinish` and by `runPrune` as thin wrapper (phase 1).

### D4 — Flags

| Flag | Meaning |
|---|---|
| `--force` | Allow dirty worktree remove only |
| `--keep-branch` | Never delete local/remote branch this run |
| `--remote` | Remote for delete (default origin); only relevant when deleting |

### D5 — Prune deprecation

- CLI `prune`: call shared delete helper; if worktree still exists, same error as today OR document “finish first / use finish”
- Actually after absorb: prune with wt present could error “use finish to remove worktree then branches” OR finish-equivalent if we want one path—**prefer**: prune becomes alias that errors if wt exists (unchanged) and if no wt runs branch delete only (same as finish without wt). Simplest: **`prune` → `runFinish` with skip worktree if missing** is messy. Cleaner: **`runPrune` calls shared branch delete only** (requires no wt as today); docs say prefer finish.
- Skill ops-prune: “prefer `openspec-ops finish`; prune is deprecated alias for branch-only cleanup”

### D6 — Auto-finish

`OPENSPEC_OPS_AUTO_FINISH` still only when orphan (no active change dir, clean wt). After archive+merged, enhanced finish will remove wt **and** branches—desired.

Ensure auto-finish does not pass keep-branch; does not force unless existing policy.

### D7 — Spec rewrites

- workspace-lifecycle: **MODIFIED** (not only ADDED) the old absolute “MUST NOT delete the branch” / “finish remains non-deleting… Prune is the explicit path” requirements so main specs do not contradict after sync
- ops-prune: mark deprecated; requirements may say “equivalent to finish branch phase”
- CLI help: finish documents `--keep-branch` and merged cleanup; prune help marks deprecated

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Surprise delete after merge | Docs; keep-branch; only when gh merged |
| Offline / no gh | Keep branch; warn not_merged |
| Wrapper prune confusion | Clear deprecation message in help |

## Open Questions (resolved)

| Q | Decision |
|---|---|
| Remote delete default | Yes |
| No worktree finish | Yes |
| Force vs unmerged | Force ≠ delete unmerged |

## Implementation sketch

```text
src/commands/branch-cleanup.ts   # shared merged branch delete
src/commands/finish.ts           # absorb
src/commands/prune.ts            # thin wrapper
src/types.ts                     # FinishOptions/Result
.pi/skills/ops-finish, ops-prune
README loop
tests/finish-closeout.test.ts
```
