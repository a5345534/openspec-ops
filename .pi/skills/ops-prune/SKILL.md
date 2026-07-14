---
name: ops-prune
description: >
  Delete local and remote openspec-ops change branches only after the PR is
  merged and the worktree is finished. Use when user says prune merged branch,
  delete change branch, or ops-prune. Never force-delete unmerged branches.
license: MIT
compatibility: Requires openspec-ops CLI and GitHub CLI gh for merge detection.
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-prune

**Deprecated for primary closeout.** Prefer `openspec-ops finish` / `/ops-finish`
(worktree remove + merged branch cleanup). prune remains branch-only if no worktree.

Delete **local + remote** change branches when:

1. Worktree is **gone** (`finish` already done)
2. A **merged** PR exists for head = change branch (`gh`)

Does **not** merge, ship, archive, or finish. Does **not** `git branch -D` unmerged tips.

## Extension-bound runtime (first)

If current agent context contains `REQUIRED: openspec-ops binary is "..." (source=...)`, verify and use that exact safely quoted executable path first; the extension also exports it as `OPENSPEC_OPS_BIN`. Never concatenate the path into `sh -c`. Without a valid binding, use the fallback below.

## Binary

1. `$OPENSPEC_OPS_BIN` if set
2. `openspec-ops` on PATH
3. Else stop with install guidance

Always:

```bash
openspec-ops prune "<change>" [--remote origin] [--branch <name>] --json
```

Require `schemaVersion === 1`. Use exit code + `error.code`.

## Exit codes (prune-relevant)

| Exit | Codes | Behavior |
|---|---|---|
| 0 | success | Report deleted / alreadyAbsent |
| 1 | usage | Fix args |
| 3 | `worktree_exists`, `branch_not_merged` | Finish first / wait for merge |
| 10 | `pr_backend_unavailable`, `git_failed`, `pr_failed` | Install gh / fix git; if `-d` failed after squash, manual `-D` is operator choice |

## Steps

1. Require change name (one change only; no bulk).
2. Confirm PR is merged on GitHub (or trust user + CLI check).
3. Prefer `finish` already done; if unsure run `where` (expect not_found).
4. Run `openspec-ops prune "<change>" --json`.
5. On `worktree_exists`: run finish (if clean) then prune.
6. On `branch_not_merged`: do not delete manually with `-D` unless user explicitly insists outside this skill.
7. On `git_failed` mentioning squash / `-d`: explain PR is merged but git wants `-D`; only do that with explicit user consent.

## Guardrails

- Never bulk-delete all merged branches.
- Never delete before merge.
- Never use prune as substitute for finish.
- Never merge the PR as part of prune.
