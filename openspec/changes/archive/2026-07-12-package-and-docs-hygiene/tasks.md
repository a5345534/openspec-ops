## 1. Package surface

- [x] 1.1 Add `.pi/skills/ops-next` (+ prompt if exists) to package.json `files`
- [x] 1.2 prebuild/clean dist; ensure no `dist/auto-*` after build
- [x] 1.3 Extend package-export tests for ops-next in files + no dist auto modules

## 2. Docs accuracy

- [x] 2.1 Fix `.pi/prompts/ops-finish.md` (and skill if needed) for merged branch cleanup
- [x] 2.2 MODIFIED worktree-loop-closure auto-finish scenarios → explicit finish
- [x] 2.3 README intercept + vendor: forward-only / no auto-ensure product pitch

## 3. Verify

- [x] 3.1 `npm run build && npm test` green
- [x] 3.2 Grep prompts for `branchDeleted: false` as unconditional success

