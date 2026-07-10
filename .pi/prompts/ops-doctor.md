---
description: Audit openspec-ops worktrees (openspec-ops doctor)
---

# ops-doctor

Read-only health report for workspaces.

**Input:** optional `--repo` or path hints in arguments.
**Provided arguments:** $@

## Shared runtime rules

### Resolve the binary

Use the first match:

1. `$OPENSPEC_OPS_BIN` if set and executable
2. `command -v openspec-ops`
3. If missing: **stop**. Tell the user to install/link `openspec-ops` from the openspec-ops repo (`npm install`, `npm run build`, `npm link`, or set `OPENSPEC_OPS_BIN`).

Never invent a fallback that runs raw `git worktree` / `git switch`.

### Always call with JSON

```bash
openspec-ops <command> ... --json
```

- Parse **stdout** as one JSON object.
- Use **exit code** + `error.code` for control flow.
- Do not scrape human prose for decisions.
- Require `schemaVersion === 1`. If missing or different: warn that CLI/skill may be mismatched; prefer stop unless the user insists.

### Success / error shapes

Success:

```json
{ "schemaVersion": 1, "ok": true, "command": "<cmd>", "result": { } }
```

Failure:

```json
{
  "schemaVersion": 1,
  "ok": false,
  "command": "<cmd>",
  "error": { "code": "...", "message": "...", "details": {} }
}
```

### Exit code table

| Exit | Meaning | Agent behavior |
|---|---|---|
| 0 | success (incl. start reuse; doctor with issues) | Use `result` |
| 1 | `usage` / `invalid_change_name` | Fix args / ask user for kebab-case name |
| 2 | `not_a_git_repo` / `base_unresolved` / `primary_unresolved` | Explain environment; do not guess base |
| 3 | conflicts (`path_occupied`, `path_not_worktree`, `branch_busy`, `branch_mismatch`, `ambiguous`) | Show `error.details`; stop; offer manual options |
| 4 | `worktree_dirty` | Only expected from finish; ask before `--force` |
| 5 | `not_found` | Suggest start or check name |
| 10 | `git_failed` / `internal` | Show error; stop |

### Hard guardrails (all ops-* helpers)

- Do **not** wrap or replace `/opsx-propose`, `/opsx-apply`, `/opsx-archive`, `/opsx-sync`.
- Do **not** run `openspec` CLI unless the **user** asked for an OpenSpec action in the same turn *after* workspace setup.
- Do **not** `git commit`, `push`, open PRs, merge, or delete branches.
- Do **not** pass `--force` unless the user clearly consents in this turn.
- Prefer working directory = workspace `path` for later implementation commands; do not assume the chat cwd switched automatically.

## Input handling

- Optional: `--repo <path>` from `$@` or user text if provided.
- No change name required.

## Steps

1. Resolve binary.
2. Run:

   ```bash
   openspec-ops doctor [--repo ...] --json
   ```

3. Outcomes:

   | Condition | What to do |
   |---|---|
   | exit 0 | Summarize even if issues exist |
   | exit 2 `not_a_git_repo` | Explain cwd/repo |
   | exit 10 | Surface error |

4. Present results in this order:

   1. `primaryPath`, `worktreeRoot`
   2. `summary` (error / warning / info counts)
   3. Each issue: `[severity] id — path — message` (+ hint if present)
   4. Short `worktrees[]` inventory (path, branch, dirty, inferredChange)

5. **Do not auto-fix.** You may suggest manual follow-ups, e.g.:

   - `stale_worktree_dir` → inspect/remove directory carefully
   - `missing_worktree_path` → `git worktree prune` (user decides)
   - `worktree_without_change_dir` → informational; may be fine before propose

6. If the user asks to clean a specific change worktree, direct them to
   `/ops-finish` rather than ad-hoc `rm`.

## Guardrails

- Read-only regarding git workspace lifecycle.
- Doctor exit 0 with warnings is normal — do not treat warnings as hard failure
  unless the user asked for a strict gate.

## Fixed phrases

- Bin missing: `openspec-ops CLI not found. Install/link it or set OPENSPEC_OPS_BIN.`
- Done: `Doctor finished (exit 0). Warnings are informational unless you want a strict gate.`
