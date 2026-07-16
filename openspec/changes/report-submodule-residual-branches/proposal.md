## Why

`finish` can completely remove the parent worktree and parent change branches while same-named branches remain inside independently versioned submodules. Because the result reports only parent cleanup, operators cannot distinguish a successful parent closeout from residual submodule branch state and may incorrectly conclude that finish cleaned—or failed to clean—the whole monorepo.

## What Changes

- Add a bounded, read-only probe for same-named local and remote-tracking branches in checked-out top-level submodules.
- Capture those diagnostics before finish deinitializes/removes the submodule worktrees.
- Include stable structured diagnostic entries in every successful finish result, clearly scoped to the submodule path/repository.
- Keep default finish diagnostic-only: do not switch, delete, fetch, push, or otherwise mutate submodule branches.
- Treat remote-tracking refs as local observations rather than proof that a remote branch currently exists or is merged.
- Document the parent-only cleanup boundary and safe manual follow-up.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `finish-closeout`: Expose residual submodule branch diagnostics separately from parent branch cleanup.
- `worktree-submodule-hygiene`: Define the bounded read-only matching-branch probe, stable diagnostics, and no-delete default.

## Impact

- Affects finish result types, submodule probe helpers, `runFinish`, finish tests, and README/skill documentation.
- Adds no network requirement, public prune flag, branch deletion, PR merge inference, or recursive nested-submodule traversal.
- Safe pruning remains a separate future change under issue #30 Phase B.
