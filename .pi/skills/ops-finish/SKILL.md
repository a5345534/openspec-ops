---
name: ops-finish
description: >
  Remove the git worktree for an OpenSpec change via openspec-ops finish;
  if PR is merged, also delete local+remote branch unless --keep-branch. Use when cleaning up a change workspace after merge
  or archive, or when the user asks to remove/delete a change worktree.
  Do not use this to archive OpenSpec specs — that is /opsx-archive.
license: MIT
compatibility: Requires openspec-ops CLI (JSON schemaVersion 1).
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-finish

## Response language

Follow the injected `REQUIRED RESPONSE LANGUAGE` for all progress, findings, verdicts, hard stops, and summaries. English examples are structural templates: translate their natural-language meaning while preserving commands, paths, identifiers, error codes, JSON keys, URLs, and metrics markers exactly.

Remove change **worktree** when present. If the PR is **merged** (gh), also delete
**local + remote** branch unless `--keep-branch`. Not an OpenSpec archive.
`prune` is deprecated—prefer finish for closeout.

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

- **Required:** change name.
- Optional: `--path`, `--branch`, `--repo` if user requested.
- `--return-to-main` when the operator requests strict local closeout or effective injected config states `finish.return-to-main=required`.
- `--sync-primary --sync-submodules` when effective injected config states `finish.return-to-main=primary-only` (do not also pass `--return-to-main` solely for that policy).
- `--force` **only** after explicit user consent in this turn when dirty.

## Steps

1. Resolve binary.
2. If change name missing/ambiguous, ask.
3. **Preflight (recommended):**

   ```bash
   openspec-ops where "<change>" --json
   ```

   - If where fails with `not_found`: report already gone; stop (do not error loudly).
   - If found: show `path`, `branch`, `dirty`, `changeDirExists`.

4. **Soft warnings (never hard-block without asking):**

   - If `dirty` is true: warn that finish will fail without `--force`; ask whether
     to commit/stash first or force-remove.
   - If `changeDirExists` is true: warn that an OpenSpec change directory still
     appears present — finish does **not** archive. Ask whether they still want
     to remove the worktree (e.g. they plan to archive from primary later, or
     intentionally tear down early).

5. Only after any needed confirmation, run:

   ```bash
   openspec-ops finish "<change>" [--force] [optional flags] --json
   ```

6. Outcomes:

   | Condition | What to do |
   |---|---|
   | exit 0 | Report action; note parent worktree/branch cleanup and separately summarize any `submoduleBranchDiagnostics` as not pruned |
   | exit 4 `worktree_dirty` | Explain; ask about `--force`; do not retry with force unprompted |
   | exit 5 `not_found` | Nothing to finish |
   | exit 3 `return_to_main_needs_human` | Hard-stop; report `details.primary`, `details.submodules`, and `details.worktreeRemoved`; never force or retry destructively |
   | exit 3/2/10 | Shared table |

7. Success report:

   ```text
   Worktree removed
   change:  <change>
   path:    <path>
   branch:  <branch> (kept)
   forced:  <true|false>
   ```

   Optional next notes (only if relevant):

   - Delete branch manually later if desired (not done by this tool).
   - Archive remains `/opsx-archive` on the appropriate checkout.

## Return-to-main policy

Effective `finish.return-to-main=off` preserves the non-mutating default. Effective `primary-only` maps to `--sync-primary --sync-submodules`: clean primary, ff-only to base, recursive submodule update to parent gitlinks (detached @ gitlink is correct sync; do not force-checkout default branch tips). Effective `required` maps to the single composite `--return-to-main` flag, which additionally resolves each initialized submodule remote default and attaches only when the branch can end exactly at the parent gitlink without reset/force. Success JSON includes `sync.primary` and `sync.submodules`; strict attach incompatibility returns `return_to_main_needs_human`.

## Closeout behavior

After removing the worktree (if any):
- `submoduleBranchDiagnostics` are read-only pre-teardown observations; remote-tracking refs may be stale, parent cleanup does not cover them, and default finish never deletes them
- Clean worktrees with submodule gitlinks may require a CLI-internal, clean-gated structural `git worktree remove --force`; this is not operator `--force`, does not authorize dirty discard, and still reports `forced: false`
- If PR for the change branch is **merged** → delete local (`-d`) and remote branch (unless `--keep-branch`)
- If **not** merged → keep branch
- No worktree + merged → branch-only cleanup still OK
- Prefer `finish` over deprecated `prune`

## After finish

Offer `/ops-next` only if useful; usually station is done.

## Guardrails

- Never imply specs were archived.
- Never delete branch, remote, or PR.
- Never pass `--force` because “it would be convenient”.
- Do not run `git worktree remove` yourself.

## Fixed phrases

- Bin missing: `openspec-ops CLI not found. Install/link it or set OPENSPEC_OPS_BIN.`
- Dirty: `Worktree is dirty. Commit/stash, or confirm force-remove.`
- Success: `Removed worktree at <path>. Branch <branch> kept. Did not archive OpenSpec.`
