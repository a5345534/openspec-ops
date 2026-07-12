## 1. CLI merge command

- [x] 1.1 Types + CLI: `merge` command, `--method` default squash (invalid → usage), help; error codes `checks_failed`, `pr_not_found` / already_merged
- [x] 1.2 gh: find open/merged PR by head; evaluate checks (fail closed if cannot evaluate or not all pass); `pr merge` with method
- [x] 1.3 `runMerge` on repo primary cwd; **worktree not required**; JSON result; no delete-branch; no archive/finish/prune
- [x] 1.4 Unit tests with mocked gh: green checks merge; red/pending/indeterminate checks block; already merged; gh missing; no worktree still OK

## 2. Skills and docs

- [x] 2.1 ops-merge skill + prompt (invoke=consent; only when user asked; checks; squash; next steps)
- [x] 2.2 One-line notes on ops-ship / ops-impl-review: do not merge; use ops-merge when user asks
- [x] 2.3 README loop + package.json files if needed

## 3. Verification

- [x] 3.1 Tests green; ship/impl-review still non-merging; no auto-merge env
