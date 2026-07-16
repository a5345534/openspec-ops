## Context

`runFinish` currently passes the public `--force` boolean directly to `git worktree remove`. After preparation, an ordinary remove that reports submodule containment triggers another prepare and another ordinary remove. Real repositories with a submodule gitlink can reject both calls regardless of whether the checkout directory was deinitialized or removed; Git requires `worktree remove --force` for structural reasons.

The public flag has a different safety meaning: operator consent to discard dirty parent or submodule work. `/ops-deliver` intentionally never supplies it. Reusing that consent bit for structural mechanics blocks clean closeout, while blindly forcing would weaken the dirty-data boundary.

## Goals / Non-Goals

**Goals:**

- Finish clean worktrees containing real submodule gitlinks without operator `--force`.
- Preserve the existing pre-removal dirty gate, including submodule dirtiness.
- Use structural force only in response to a recognized containment refusal and only after a fresh clean check.
- Keep result semantics truthful: `forced` means dirty discard was operator-authorized.
- Cover the behavior with real Git repositories and submodule gitlinks.

**Non-Goals:**

- Prune submodule feature branches (tracked separately by issue #30).
- Force removal after arbitrary Git failures.
- Auto-update primary branches or submodules.
- Introduce a new public CLI flag.

## Decisions

### Add an explicit post-prepare clean verifier dependency

`FinishDeps` will expose `isDirty`, defaulting to the existing Git status helper. The initial location result remains the first dirty gate. If ordinary removal reports recognized submodule containment and the operator did not request discard force, finish will call `isDirty` immediately before structural removal.

If that check is dirty, finish fails without structural force. This prevents preparation side effects or races from being discarded silently.

### Use one controlled structural-force retry

After recognized containment on a clean target, finish will retry `removeWorktree` exactly once with its internal force argument set to true. It will not run prepare a second time: preparation already completed, and repeated deinit/cleanup does not change Git's index-level submodule containment rule.

If structural removal still reports containment, finish returns `submodule_teardown_failed`. Non-containment errors remain their original errors.

### Keep public result semantics unchanged

`FinishResult.forced` remains `operatorForce && initialDirty`. Internal structural force is an implementation mechanism and does not imply that dirty content was discarded. No response schema change is needed.

### Add a real-Git integration test

The test will create a local submodule repository, a parent repository with a submodule gitlink, and a linked change worktree. It will prove that plain `git worktree remove` hits the actual containment behavior where supported, then verify `runFinish` removes the clean worktree without public force. Separate tests retain dirty-parent and dirty-submodule refusal coverage.

## Risks / Trade-offs

- [Worktree changes between clean verification and forced removal] → The verification occurs immediately before the synchronous Git command; this matches existing local CLI race assumptions.
- [Locale-specific containment messages are missed] → Retain English and Chinese matching and stable fallback behavior.
- [Preparation itself creates synthetic dirtiness] → Recheck blocks structural force and reports the target instead of discarding it.
- [Git versions differ in containment behavior] → Integration setup asserts the repository shape, while unit tests deterministically cover the controlled retry branch.
