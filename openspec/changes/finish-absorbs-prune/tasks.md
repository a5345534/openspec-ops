## 1. Shared branch cleanup + finish

- [x] 1.1 Extract shared “delete local+remote if PR merged” helper from prune ( -d only; remote delete; alreadyAbsent)
- [x] 1.2 Extend finish: optional worktree (not_found → branch-only); `--keep-branch`; `--remote`; after wt remove, run branch cleanup unless keep
- [x] 1.3 FinishResult/Options types + JSON actions (`removed`, `removed_and_pruned`, `pruned_only`, `already_clean`)
- [x] 1.4 Unit tests: merged+wt; unmerged keeps branch; keep-branch; no wt branch-only; force does not delete unmerged
- [x] 1.5 Ensure delta includes **MODIFIED** lifecycle requirements so archive sync replaces absolute “never delete branch” / “prune is the only path” text

## 2. Prune deprecation and skills/docs

- [x] 2.1 prune CLI thin wrapper / deprecation help text; skill redirects to finish
- [x] 2.2 ops-finish skill/prompt: document new behavior
- [x] 2.3 README loop: archive → finish; prune optional/deprecated

## 3. Verification

- [x] 3.1 Tests green; no -D; no auto-merge/archive in finish; auto-finish still no --force
