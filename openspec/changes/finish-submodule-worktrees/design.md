## Context

Git issue #3: `git worktree remove` fails if the worktree contains submodules. Current finish:

```text
locateWorkspace → dirty check → removeWorktree(cwd, path, force)
```

`removeWorktree` only runs `git worktree remove [--force] <path>`.

Probe already lists top-level submodule paths and dirty/detached state.

## Goals / Non-Goals

**Goals:**
- Finish succeeds on **clean** change worktrees with initialized top-level submodules.
- Branch retained; worktree unregistered and path removed.
- Dirty parent still requires commit/stash or `--force` as today.
- Actionable error if submodule teardown fails.

**Non-Goals:**
- Auto-commit submodule or parent content.
- Option C (auto branch at start) from issue #2.
- Guaranteeing every nested submodule-of-submodule without top-level listing.
- Changing prune/merge/ship beyond finish path.

## Decisions

### D1 — Order of operations

```text
1. locateWorkspace
2. if dirty && !force → worktree_dirty (existing message, submodule-aware text OK)
3. prepareWorktreeForRemoval(worktreePath):
     a. list top-level submodule paths (.gitmodules / probe)
     b. for each path that looks initialized (has .git file/dir or probe sees repo):
          run from worktreePath: git submodule deinit -f -- <relPath>
          (allowFailure per path? prefer fail with aggregate error if still blocking)
     c. optional: git submodule deinit -f --all if simpler and safe on git version
4. removeWorktree(primaryCwd, path, force)
5. success branchDeleted: false
```

**v1:** deinit **explicit paths** from `.gitmodules` / probe (top-level only). Do not rely on `deinit --all` as the only path (optional extra if already available).

### D2 — Dirty vs force

- Uncommitted parent or submodule dirt still blocked without `--force`.
- With `--force`, existing semantics: allow remove despite dirty; **still deinit first** so git can remove the worktree.
- Force must not become silent data-loss beyond today’s force meaning; deinit `-f` unregisters submodule worktrees from that superproject worktree.

### D3 — Error codes

| Situation | Code |
|---|---|
| Dirty, no force | `worktree_dirty` (unchanged) |
| Deinit fails / still contains submodules after prepare | **`submodule_teardown_failed`** (stable; do not use a second alias) |
| Other git remove failure | `git_failed` |

Hint: list submodule paths and manual `git submodule deinit -f -- <path>` then retry finish.

### D4 — Implementation locus

- New helper e.g. `src/submodules/teardown.ts` or `prepareWorktreeForRemoval` next to probe.
- `runFinish` calls helper before `removeWorktree`.
- Keep `removeWorktree` thin or enhance message mapping when stderr matches submodule containment.

### D5 — Tests

- Unit: prepare calls deinit for each initialized path; remove invoked after.
- Integration/fixture if feasible: temp repo + submodule + worktree + finish (may be heavy; inject runGit).

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| deinit -f drops submodule checkout in that worktree | Intended before delete; worktree going away |
| Partial deinit | Fail with path list; don’t claim success |
| Nested modules under `.git/worktrees/.../modules` | deinit should unregister; document residual manual prune if needed |

## Open Questions (resolved)

| Q | Decision |
|---|---|
| Scope | Top-level submodules via existing probe |
| Force | Still required for dirty; deinit before remove always when submodules present |
| Issue | #3 |

## Implementation sketch

```text
src/submodules/teardown.ts
src/commands/finish.ts
src/types.ts              # error code
tests/finish-submodule.test.ts
README finish/submodule closeout note
```
