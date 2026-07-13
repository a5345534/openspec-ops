## Approach

### 1. Residual dir cleanup in prepare

After each successful `git submodule deinit -f -- <path>` (and for any listed path that is **not** initialized but still exists as a directory):

- If `join(worktree, path)` exists and `looksInitialized` is false → `rmSync(abs, { recursive: true, force: true })`.
- Do **not** delete paths that still look initialized (would risk wiping live checkout).
- Track `cleared: string[]` in prepare result (optional; finish may ignore).

Rationale: deinit often leaves empty or hollow dirs; git worktree remove still treats the worktree as containing submodules.

### 2. Finish single retry

```text
prepare(path)
try removeWorktree
catch containment:
  prepare(path) again
  try removeWorktree once more
  catch → submodule_teardown_failed (existing message shape)
```

Only retry when `isSubmoduleContainmentError`; other errors propagate unchanged.

### 3. Tests

- Unit: after mocked deinit, residual dir without `.git` is removed by prepare.
- Unit: finish deps — first remove throws containment, second succeeds after second prepare.
- Keep Chinese/English containment detection tests.

### 4. Out of scope

Submodule remote branch prune (separate change).
