---
name: ops-ship
description: >
  Commit the entire openspec-ops change worktree, push the branch, and open a
  GitHub PR via openspec-ops ship (gh). Use after apply when the user wants
  commit+PR, or says "ship", "open PR", "ops ship". Does not merge or archive.
license: MIT
compatibility: Requires openspec-ops CLI (JSON schemaVersion 1) and GitHub CLI gh for PRs.
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-ship

Commit **all** changes in a change worktree, push the branch (no force), open a PR via `gh`.

Does **not** merge, archive OpenSpec changes, or run `finish`.

## Shared runtime rules

### Extension-bound runtime (first)

If current agent context contains `REQUIRED: openspec-ops binary is "..." (source=...)`, first verify that exact path is still executable and use it as one safely quoted command path. The guided extension has already applied explicit-override/package/PATH precedence and exported the same path as `OPENSPEC_OPS_BIN`. Never concatenate the path into `sh -c`.

If no valid extension binding is present, use the standalone fallback below.

### Resolve the binary

Use the first match:

1. `$OPENSPEC_OPS_BIN` if set and executable
2. `command -v openspec-ops`
3. If missing: **stop**. Install/link `openspec-ops` or set `OPENSPEC_OPS_BIN`.

Never invent a fallback that runs raw `git worktree` as a substitute for lifecycle commands. For ship, prefer the CLI over hand-rolled commit/push unless the user asked for manual git.

### Always call with JSON

```bash
openspec-ops ship "<change>" [flags] --json
```

- Parse **stdout** as one JSON object.
- Use **exit code** + `error.code` for control flow.
- Require `schemaVersion === 1`.

### Exit code table (ship-relevant)

| Exit | Codes | Agent behavior |
|---|---|---|
| 0 | success | Report PR URL from `result.pr` |
| 1 | `usage` / `invalid_change_name` | Fix args |
| 2 | repo/base errors | Explain environment |
| 3 | `submodule_detached_dirty`, `nothing_to_ship`, `remote_not_configured`, `remote_invalid`, `github_repository_not_found`, `push_rejected`, conflicts | Show structured details; fix destination/submodule/state |
| 5 | `not_found` | Suggest `/ops-start` first |
| 10 | `github_auth_failed`, `github_repository_unavailable`, `push_auth_failed`, `push_failed`, `pr_backend_unavailable`, `pr_failed`, `internal` | Show mutation facts and remediation; a clean rerun creates no duplicate commit |

### Hard guardrails

- Do **not** merge the PR. If the user asks to merge, use `/ops-merge` / `openspec-ops merge` (not raw `gh pr merge` ad hoc).
- Do **not** use `finish` as a substitute for ship.
- Do **not** pass git push `--force`.
- Prefer explicit user consent before ship when the worktree has large/unexpected diffs.
- Default commit message if user did not specify: `ship(<change>): worktree`.

## Input

- **Required:** change name (kebab-case).
- Optional flags (only if user asked): `--message`/`-m`, `--title`, `--body`, `--draft`, `--remote`, `--base`, `--backend` (default `gh`), `--path`, `--branch`, `--repo`.

## Steps

1. Resolve binary.
2. Confirm change name; if missing, ask.
3. Optionally `openspec-ops where "<change>" --json` to show path and `submodules`.
4. If user has not consented and diffs may be large, confirm before shipping.
5. Run:

   ```bash
   openspec-ops ship "<change>" [flags] --json
   ```

6. On success: report `result.pr.url`, branch, whether a commit was created.
7. On remote/GitHub preflight errors: report `remote`, repository identity when present, `commitCreated: false`, and `pushOk: false`; do not bootstrap a repository implicitly. Warn that first push publishes branch-reachable history.
8. On `submodule_detached_dirty`: tell user to branch/commit inside the submodule first.
9. On auth/repository errors: use the structured action (`gh auth login`, configure/create remote explicitly).
10. On push/PR failure after a commit: report `commitCreated`, `commitSha`, and `pushOk`; fix the destination and **re-run ship** (clean tree → no duplicate commit).
11. **Next step (no auto):** After **successful** ship, offer `/ops-next <change>` (impl-review | ship again | merge | stop). Do **not** auto-run impl-review.

## Guardrails

- Ship is not archive and not finish.
- OpenSpec `/opsx-*` flows remain separate.
- Never auto-merge. To merge, user must explicitly run `/ops-merge` / `openspec-ops merge` (not this skill).
- Impl-review only if operator chooses it via `/ops-next` or runs `/ops-impl-review`.

## Fixed phrases

- Success: `Shipped <change>: PR <url> (branch <branch>).`
- Missing worktree: `No worktree for <change>. Run /ops-start first.`
- Submodule: `Ship blocked: submodule detached and dirty. Commit in the submodule, then parent gitlink, then re-run ship.`
