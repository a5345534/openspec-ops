## 1. Discovery

- [x] 1.1 Replace basename(root) rule with worktree-leaf-only (`parent === .worktrees`)
- [x] 1.2 Keep active `openspec/changes/<kebab>` and `.worktrees/<kebab>` scans
- [x] 1.3 Unit tests: no false `openspec-ops` from package root; worktree cwd leaf still found
- [x] 1.4 ops-next skill discovery blurb

## 2. Verify

- [x] 2.1 Tests green; manual mental check PACKAGE_ROOT + empty changes → `[]`
