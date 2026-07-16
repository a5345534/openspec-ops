## 1. Controlled Structural Removal

- [x] 1.1 Add a fresh worktree dirty verifier to finish dependencies and preserve the existing operator-force dirty gate.
- [x] 1.2 Replace repeated preparation after containment with one clean-gated structural-force removal attempt.
- [x] 1.3 Preserve truthful `forced` result semantics and stable error mapping for dirty, containment, and unrelated Git failures.

## 2. Regression Coverage

- [x] 2.1 Update unit tests for clean structural force, post-prepare dirtiness, repeated containment, unrelated errors, and operator force.
- [x] 2.2 Add a real-Git integration fixture with a submodule gitlink covering initialized and deinitialized clean worktrees.
- [x] 2.3 Confirm dirty parent and dirty submodule worktrees remain blocked without operator `--force`.

## 3. Documentation and Verification

- [x] 3.1 Update finish/submodule documentation to distinguish structural force from dirty-discard consent.
- [x] 3.2 Run OpenSpec validation, type checking, targeted tests, and the full test suite.
