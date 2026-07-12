## 1. Teardown helper

- [x] 1.1 Add prepare/teardown helper: list top-level submodule paths; deinit initialized ones inside worktree (`git submodule deinit -f -- <path>` or equivalent)
- [x] 1.2 Map failures to **`submodule_teardown_failed`** with path hints; types + exit mapping
- [x] 1.3 Unit tests with injected git: deinit called then remove; deinit failure does not claim success

## 2. Finish integration and docs

- [x] 2.1 `runFinish`: after dirty check, call prepare then `removeWorktree`; keep branchDeleted false
- [x] 2.2 README / help: finish + submodule worktree closeout note
- [x] 2.3 Tests green; no auto-commit; dirty-without-force still blocked
