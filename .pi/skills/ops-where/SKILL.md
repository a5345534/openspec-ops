---
name: ops-where
description: >
  Locate the openspec-ops worktree for a change (path, branch, dirty).
  Use when the user asks where a change workspace is, needs a path to cd,
  or before running commands in the correct worktree.
license: MIT
compatibility: Requires openspec-ops CLI (JSON schemaVersion 1).
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-where

## Response language

Follow the injected `REQUIRED RESPONSE LANGUAGE` for all progress, findings, verdicts, hard stops, and summaries. English examples are structural templates: translate their natural-language meaning while preserving commands, paths, identifiers, error codes, JSON keys, URLs, and metrics markers exactly.

Read-only lookup for a change workspace.

## Shared runtime rules

### Extension-bound runtime (first)

If current agent context contains `REQUIRED: openspec-ops binary is "..." (source=...)`, first verify that exact path is still executable and use it as one safely quoted command path. The guided extension has already applied explicit-override/package/PATH precedence and exported the same path as `OPENSPEC_OPS_BIN`. Never concatenate the path into `sh -c`.

If no valid extension binding is present, use the standalone fallback below.

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

### Hard guardrails (all ops-* skills)

- Do **not** wrap or replace `/opsx-propose`, `/opsx-apply`, `/opsx-archive`, `/opsx-sync`.
- Do **not** run `openspec` CLI unless the **user** asked for an OpenSpec action in the same turn *after* workspace setup.
- Do **not** `git commit`, `push`, open PRs, merge, or delete branches.
- Do **not** pass `--force` unless the user clearly consents in this turn.
- Prefer working directory = workspace `path` for later implementation commands; do not assume the chat cwd switched automatically.

## Input

- **Required:** change name (kebab-case).
- Optional: `--path`, `--branch`, `--repo` only if user requested.

If missing change name, ask. Do not pick an arbitrary active change.

## Steps

1. Resolve binary.
2. Run:

   ```bash
   openspec-ops where "<change>" [optional flags] --json
   ```

3. Outcomes:

   | Condition | What to do |
   |---|---|
   | exit 0 | Show path, branch, dirty, matchedBy, changeDirExists |
   | exit 5 `not_found` | Say not found; suggest `ops-start` / `/ops-start` |
   | exit 3 `ambiguous` | Show paths from details; ask which one |
   | exit 2 | Not a git repo / repo flag issue |
   | other | Shared table |

4. Success report format:

   ```text
   change:  <change>
   branch:  <branch>
   path:    <path>
   dirty:   <true|false>
   match:   <path|branch>
   changeDirExists: <true|false>
   ```

5. If the user wants to work there: state that subsequent commands should use
   `path` as cwd. Do not pretend the shell already changed directory unless
   you actually run later tools with that cwd.

## Guardrails

- Read-only: never start/finish as a side effect of where.
- On not_found, do **not** auto-run start unless the user asked to create it.

## Fixed phrases

- Bin missing: `openspec-ops CLI not found. Install/link it or set OPENSPEC_OPS_BIN.`
- Not found: `No worktree for <change>. Create one with /ops-start <change>.`
