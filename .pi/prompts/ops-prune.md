# ops-prune (deprecated)

Prefer `/ops-finish`. ---
name: ops-prune
description: Delete local+remote change branches only if PR merged and worktree finished.
---

# /ops-prune

```bash
openspec-ops prune "<change>" [--remote origin] [--branch <name>] --json
```

**Only after** PR merge and **finish** (no worktree). Deletes local + remote. Never force-delete unmerged.

1. Resolve `openspec-ops` (`OPENSPEC_OPS_BIN` or PATH).
2. Require change name.
3. Run prune with `--json`; require `schemaVersion === 1`.
4. `worktree_exists` → finish first. `branch_not_merged` → do not delete.
5. Do not merge, ship, or archive as part of prune.
