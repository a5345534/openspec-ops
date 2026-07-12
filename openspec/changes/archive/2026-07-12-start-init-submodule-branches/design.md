# Design: start-init-submodule-branches

## Flag

```text
openspec-ops start <change> --init-submodule-branches
```

Default: **off**. Reuse path: if worktree reused and flag set, still run init on current worktree.

## Algorithm

```text
after parent worktree ready (created | reused):
  if !initSubmoduleBranches: return
  for each top-level submodule path from .gitmodules that exists and is a git dir:
    if not detached: skip (already on a branch)
    branchName = parent change branch (default = change name)
    if branch exists locally: git switch branchName
    else: git switch -c branchName
    record { path, branch, action: switched|created|skipped|failed, message? }
  never git commit
  never update parent gitlink
```

## Failure policy

- Individual submodule git failures → warning entry, continue others
- Parent start success is independent

## Result

```json
"submoduleBranches": [
  { "path": "aos-core", "branch": "my-change", "action": "created" }
]
```

Empty array when flag off or no submodules.

## Tests

- Unit: pure init helper with mock git
- No fixture monorepo required if git runner injected
