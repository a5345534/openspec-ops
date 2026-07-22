## 1. Types and cleanup helper

- [x] 1.1 Extend finish result types for per-head parent cleanup detail while keeping aggregate `branchCleanup` fields for compatibility
- [x] 1.2 Add a small helper (or finish-local logic) to build the deduped candidate list: change-default ∪ located branch
- [x] 1.3 Invoke `cleanupMergedChangeBranches` once per distinct candidate head; aggregate results and preserve keep-branch / error behavior

## 2. Finish command integration

- [x] 2.1 Wire multi-head cleanup into `runFinish` after worktree removal / branch-only path
- [x] 2.2 Update action classification (`removed_and_pruned` / `pruned_only` / not_found messages) for multi-head outcomes
- [x] 2.3 Update human `printSuccess` lines to show per-head outcomes when more than one head is considered
- [x] 2.4 Keep submodule diagnostics probing on the located/resolved branch only (no submodule prune)

## 3. Tests

- [x] 3.1 Unit test: same change-default and located → single cleanup call
- [x] 3.2 Unit test: located differs (archive switch) → both heads cleaned when each has merged PR
- [x] 3.3 Unit test: only change-default merged → located unmerged kept
- [x] 3.4 Unit test: keep-branch skips all heads; not_merged on all heads keeps branches
- [x] 3.5 Unit test: JSON includes per-head detail; `branchDeleted` true if any local delete

## 4. Docs and skills

- [x] 4.1 Update README finish/closeout notes for multi-head parent cleanup and issue #46 hygiene
- [x] 4.2 Update `.pi/skills/ops-finish` (and prompt if present) for multi-head cleanup + archive-on-change-branch preference
- [x] 4.3 Update `.pi/skills/ops-deliver` for finish covering change-default head without mandatory extra prune; no submodule remote prune promise

## 5. Verify

- [x] 5.1 Run targeted unit tests for finish closeout / branch cleanup
- [x] 5.2 Smoke `openspec-ops finish --help` / typecheck or package test surface as needed
