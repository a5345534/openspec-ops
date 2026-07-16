## Why

Git can require `git worktree remove --force` solely because a verified-clean worktree contains a submodule gitlink. `finish` currently treats that structural requirement as equivalent to operator permission to discard dirty data, so `/ops-deliver` hard-stops even after both the parent worktree and submodules were proven clean.

## What Changes

- Separate operator discard force from an internal structural-removal force.
- Permit one controlled forced worktree removal only after ordinary removal reports submodule containment and the target has already been verified clean.
- Keep dirty parent or submodule worktrees blocked unless the operator explicitly supplies `--force`.
- Avoid repeated destructive preparation and preserve stable teardown errors for genuine failures.
- Add a real Git integration fixture containing a submodule gitlink, alongside unit coverage for clean, dirty, and containment paths.
- Clarify that `forced` in the finish result indicates operator-authorized dirty discard, not safe internal structural removal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `finish-submodule-teardown`: Allow controlled structural force for verified-clean submodule worktrees while retaining dirty-data safety.
- `workspace-lifecycle`: Distinguish structural removal mechanics from operator discard permission in finish behavior.

## Impact

- Affects `src/commands/finish.ts`, Git worktree removal calls, finish/submodule tests, and finish documentation.
- Does not add a public force flag, weaken dirty checks, prune submodule branches, or update the primary checkout.
