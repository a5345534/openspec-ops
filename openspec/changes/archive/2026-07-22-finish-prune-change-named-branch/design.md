## Context

Today `runFinish` resolves a single branch for cleanup:

1. `defaultBranch(change, options.branch)` as the default
2. If a worktree is found, **overwrite** with `loc.branch` (worktree current branch)
3. Call `cleanupMergedChangeBranches` once for that head

When deliver/archive agents leave the worktree on `archive-<change>` after the feature PR for `<change>` already merged, finish prunes only `archive-…` and leaves parent local/remote `<change>` behind (issue #46). Branch-only finish (no worktree) already uses the change-default name, so the gap is specifically **worktree present + located branch ≠ change-default**.

Constraints carried forward:

- Never force-delete unmerged branches
- Local delete uses `git branch -d` only (not `-D`)
- Parent cleanup does not delete submodule branches (diagnostics only)
- Finish does not archive OpenSpec changes or merge PRs

## Goals / Non-Goals

**Goals:**

- Finish attempts safe parent cleanup for a **bounded set** of heads: change-default ∪ resolved located (deduped)
- Each head independently requires a verified merged PR before delete
- Operators can see per-head outcomes in JSON/human output
- Skills/docs discourage archive workflows that abandon the change-named branch without cleanup, and state the new multi-head behavior

**Non-Goals:**

- Scanning or deleting arbitrary historical branches for a change
- Force-deleting after squash (`-D`) or rewriting history
- Submodule local/remote feature-branch prune (issue #30 Phase B)
- Changing squash-merge semantics or treating residual branches as merge failure
- Auto-creating or renaming archive branches

## Decisions

### D1: Candidate set = changeDefault ∪ located (dedupe), not “all ever used”

**Choice:** Build an ordered unique list:

1. `changeDefault = defaultBranch(change, options.branch)` — note: when `--branch` is set, changeDefault **is** that flag value (existing `defaultBranch` helper)
2. `locatedBranch` from worktree when present, else same as changeDefault
3. If equal, cleanup once; if different, cleanup both

**Why not** also hardcode `archive-<change>`: optional convention only; if worktree is on that branch it is already in `locatedBranch`. Avoid inventing name patterns beyond Git/PR evidence.

**Why not** “all branches matching change prefix”: unsafe and unbounded.

### D2: Independent merged-PR gate per head

Reuse `cleanupMergedChangeBranches` (or a thin multi-call wrapper) **once per candidate**. Feature PR merge must not authorize deleting an unmerged archive head (and vice versa).

### D3: Result shape — aggregate + details

Keep top-level `branchCleanup` as a **compatibility aggregate** so existing consumers do not break:

- `attempted`: true if any head attempted
- `localDeleted` / `remoteDeleted`: true if any head deleted that side
- `localAlreadyAbsent` / `remoteAlreadyAbsent`: true only if every attempted head had that side absent (or define carefully in impl — prefer “all candidates that ran”)
- `keptReason`: `keep_flag` if keep-branch; else `not_merged` only if **no** head was cleaned and at least one was not_merged; else null when any cleaned
- `mergedPr`: prefer the change-default head’s merged PR when present, else first cleaned head’s PR

Add `branchCleanup.heads: Array<{ branch, ...perHead fields }>` (or sibling `branchCleanups[]`) for full fidelity. Human lines list each head briefly.

`result.branch` remains the **located/primary** display branch (worktree branch when present) for continuity with `where`.

`branchDeleted` remains “any local delete this run” (existing boolean meaning).

### D4: Action classification

`removed_and_pruned` / `pruned_only` when **any** head local or remote deleted.  
`removed` when worktree removed but no head deleted (e.g. all not_merged or already absent without deletes).  
Branch-only `not_found` when no worktree **and** no head could be cleaned (all not_merged / keep_flag) — preserve current fail-closed behavior, but message may mention multiple heads checked.

### D5: Submodule diagnostics stay on located branch

Do **not** expand submodule probe to every candidate in this change. Probe remains against the resolved parent finish branch (located / explicit), matching existing finish-closeout submodule residual requirements. Multi-head is parent cleanup only.

### D6: Skills/docs

- `ops-finish`: document multi-head parent cleanup
- `ops-deliver`: after finish, change-named parent branches with merged PRs should be gone; do not switch worktree to a new archive-only branch as the sole closeout head without understanding finish will still target change-default
- Prefer performing OpenSpec archive while still on the change branch (artifact move does not require a new git branch)

### Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Only document “don’t switch branches” | Does not fix residual branches already left by agents |
| Second manual `ops-prune` step in deliver | prune deprecated; finish should close the inventory |
| Always `-D` after squash | Unsafe; existing product policy |
| Include submodule remotes | Separate safety model (#30) |

## Risks / Trade-offs

- **[Risk] JSON consumers assume single-head `branchCleanup`** → Mitigation: keep aggregate fields; add additive `heads` detail; document in README
- **[Risk] Two gh PR lookups increase latency / flake** → Mitigation: only second call when heads differ; soft failure per head unchanged
- **[Risk] `--branch` flag makes changeDefault ≡ flag, so “always prune `<change>` name” fails when operator overrides** → Mitigation: document that explicit `--branch` replaces the default name (existing helper semantics); optional future: always include raw change name as third candidate — **defer** unless tests show need; proposal said “change-named” via defaultBranch helper
- **[Risk] Squash makes `-d` fail on change-named tip** → Mitigation: existing error path; do not introduce `-D`
- **[Risk] Partial success (archive cleaned, change-named `-d` fails)** → Mitigation: fail the command on delete error (current behavior) so operators see the problem; do not silently report full success

## Migration Plan

- Pure behavior expansion on finish; no data migration
- Ship behind normal PR; no feature flag required (safe default: only deletes with merged PR proof)
- Rollback: revert commit; worst case reverts to single-head cleanup

## Open Questions

- None blocking: raw change name as third candidate when `--branch` overrides is deferred (document only).
