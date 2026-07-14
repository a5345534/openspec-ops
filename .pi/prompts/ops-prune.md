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

If current agent context contains the extension-bound `REQUIRED: openspec-ops binary is "..." (source=...)`, verify and use that exact safely quoted executable path first; the extension also exports it as `OPENSPEC_OPS_BIN`. Never concatenate the path into `sh -c`. Otherwise use the fallback below.

1. Resolve `openspec-ops` (`OPENSPEC_OPS_BIN` or PATH).
2. Require change name.
3. Run prune with `--json`; require `schemaVersion === 1`.
4. `worktree_exists` → finish first. `branch_not_merged` → do not delete.
5. Do not merge, ship, or archive as part of prune.
