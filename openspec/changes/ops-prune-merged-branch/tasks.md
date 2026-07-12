## 1. Core prune command

- [x] 1.1 Types + CLI: `prune` command, flags (`--remote`, `--branch`), help; error codes `worktree_exists`, `branch_not_merged`, reuse `pr_backend_unavailable` / `git_failed`
- [x] 1.2 gh helper: `findMergedPullRequest({ cwd, head })` (merged state only; head = branch name)
- [x] 1.3 `runPrune` on repo primary cwd: worktree guard → merged PR check → local `branch -d` only (no `-D`) → remote `push --delete` → JSON (alreadyAbsent local/remote success)
- [x] 1.4 Unit tests: happy path; worktree blocks; not merged; gh missing; local absent + remote deleted; remote alreadyAbsent; `-d` fail after merged does not call `-D`

## 2. Package surface and docs

- [x] 2.1 ops-prune skill + prompt
- [x] 2.2 Verify package.json ops-* globs pick up skill/prompt
- [x] 2.3 README: loop finish → prune; rules; complementary GitHub auto-delete note optional

## 3. Verification

- [x] 3.1 Tests green; finish default still keeps branch; no bulk prune; no merge/archive side effects
