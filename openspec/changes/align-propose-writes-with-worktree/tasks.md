## 1. Contract and skills

- [x] 1.1 Update package propose skill + opsx-propose prompt: after name known → where/start → cwd=`path`; **fail-closed** when alignment required (`ops` resolvable and `AUTO_START` ≠ `off`); **warn-and-allow primary** when `AUTO_START=off` or ops missing
- [x] 1.2 Wrap ops steps in `<!-- openspec-ops:worktree-alignment BEGIN/END -->` markers
- [x] 1.3 Update package apply skill/prompt: prefer worktree cwd when `where` succeeds; state ensure/start alone does not switch process cwd

## 2. Extension

- [x] 2.1 After ensure success, inject REQUIRED write-path constraint with absolute worktree path
- [x] 2.2 On propose-intent without parseable name, notify ensure/alignment deferred until name/`new change`

## 3. Doctor and README

- [x] 3.1 Doctor: ops bin resolvable; optional warn if `openspec` ≠ intercept; note REAL_BIN; warn if propose skill missing alignment markers
- [x] 3.2 README: ensure ≠ cwd; fail-closed vs `AUTO_START=off`; skill markers; intercept enable/verify; dual-tree manual cleanup; issue #1

## 4. Verification

- [x] 4.1 Smoke/test: start → propose with cwd=worktree → change under worktree; primary-only = misconfiguration when alignment required
- [x] 4.2 Unit tests for new pure doctor helpers; suite green
- [x] 4.3 No OpenSpec upstream package source changes
