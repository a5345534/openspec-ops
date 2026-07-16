---
name: ops-start
description: >
  Create or reuse a git worktree and branch for an OpenSpec change name
  via openspec-ops start. Use when the user wants a change workspace/worktree,
  before /opsx-propose, or says "start worktree", "ops start", or
  "set up branch/worktree for this change".
license: MIT
compatibility: >
  Requires openspec-ops CLI (JSON schemaVersion 1). Does not replace OpenSpec.
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-start

## Response language

Follow the injected `REQUIRED RESPONSE LANGUAGE` for all progress, findings, verdicts, hard stops, and summaries. English examples are structural templates: translate their natural-language meaning while preserving commands, paths, identifiers, error codes, JSON keys, URLs, and metrics markers exactly.

Ensure a **git workspace** exists for a change name.

This skill only runs `openspec-ops start`. It does **not** create OpenSpec
artifacts and does **not** run `/opsx-propose`.

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

## Submodules (opt-in)

For monorepos: `openspec-ops start <change> --init-submodule-branches` creates/switches a named branch (same as change branch) inside **detached** top-level submodules. Does **not** commit. Prefer this before long implementation in submodule paths.

## Input

- **Required:** change name in kebab-case, OR a short description.
- If only a description is given, derive a kebab-case name and **confirm** it
  before calling the CLI (example: "add dark mode" → `add-dark-mode`).
- Optional flags — pass through **only** if the user explicitly asked:
  - `--branch <name>`
  - `--path <path>`
  - `--base <ref>`
  - `--repo <path>`

If the change name is missing/ambiguous, ask. Do not invent a second name
after a failed start without asking.

## Steps

1. Resolve the `openspec-ops` binary (see Shared runtime rules).
2. Normalize/confirm the change name (`^[a-z0-9]+(?:-[a-z0-9]+)*$` mentally;
   let the CLI be the authority on validation).
3. Run:

   ```bash
   openspec-ops start "<change>" [optional flags] --json
   ```

4. Handle outcomes:

   | Condition | What to do |
   |---|---|
   | exit 0, `result.action=created` | Report created workspace |
   | exit 0, `result.action=reused` | Report existing workspace (not an error) |
   | exit 1 `invalid_change_name` | Ask for a valid kebab-case name |
   | exit 2 `not_a_git_repo` | Tell user to run inside a git repo or pass `--repo` |
   | exit 2 `base_unresolved` | Ask for explicit `--base` (e.g. `main` or `origin/main`) |
   | exit 3 `branch_busy` | Show other path from details; do not force |
   | exit 3 `path_not_worktree` / `path_occupied` / `branch_mismatch` | Show path conflict; suggest different `--path` or manual cleanup |
   | exit 10 | Surface `error.message` / details; stop |

5. On success, print a short status block:

   ```text
   Workspace ready
   action:  <created|reused>
   change:  <change>
   branch:  <branch>
   path:    <path>
   changeDirExists: <true|false>
   ```

6. Next-step policy:

   - If the user **only** asked to create/setup a worktree: **stop here**.
   - If the user asked to **begin the change / propose / implement**: you MAY
     continue with OpenSpec (`/opsx-propose` or the openspec-propose skill)
     **using `result.path` as the working directory** for those commands.
     Still treat OpenSpec as a separate step—do not claim ops-start did propose.

7. If `changeDirExists` is `false`, add one line:

   > No `openspec/changes/<change>` directory yet — normal before propose.

8. **Submodules:** If the worktree has git submodules (see `where` → `result.submodules`, or `.gitmodules`), do **not** leave long-lived implementation on **detached HEAD** inside a submodule. Create/switch a named branch in the submodule before substantial edits; commit in the submodule first, then update the parent gitlink. Path alignment / start does **not** create submodule feature branches.

## Guardrails

- Idempotent reuse is success.
- Never move/switch the primary branch as a side ritual.
- Never create nested worktrees by hand under an existing linked worktree.
- Do not chain `finish` after start.

## Fixed phrases

- Bin missing: `openspec-ops CLI not found. Install/link it or set OPENSPEC_OPS_BIN.`
- Created: `Created worktree for <change> at <path> (branch <branch>).`
- Reused: `Reused existing worktree for <change> at <path>.`
- Handoff: `OpenSpec flow unchanged: /opsx-propose → /opsx-apply → /opsx-archive. Workspace helpers: /ops-start … /ops-finish.`
