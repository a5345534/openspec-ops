## Context

Locked decisions:

| Topic | Choice |
|---|---|
| Surface | **CLI + skill** |
| Default method | **squash** |
| Consent | **Running the command = confirm** (no second prompt / no required `--yes`) |
| Checks | **Hard block** if not fully green |
| Chain prune/archive/finish | **No** |
| Auto-merge policy | **No** (v1) |

Ship / impl-review continue to forbid merge; only `merge` / `ops-merge` may merge.

## Goals / Non-Goals

**Goals:**
- Explicit, scriptable merge of the change’s open PR via `gh`.
- Fail closed on failing/pending/missing required checks.
- Clear JSON + human output; already-merged is non-destructive.
- Skill contract: agent invokes only when user asked to merge.

**Non-Goals:**
- Auto-merge after impl-review or on timer.
- Default delete of head branch (use `prune` after merge).
- Running OpenSpec archive or finish inside merge.
- Bypassing branch protection without an explicit future admin flag (v1: no admin skip).

## Decisions

### D1 — CLI shape

```text
openspec-ops merge <change>
  [--method squash|merge|rebase]   # default squash
  [--branch B] [--remote R]        # defaults like lifecycle
  [--json] [--repo PATH]
```

No `--yes` required for consent (invoke = consent).  
No `--delete-branch` in v1 happy path.

### D2 — Algorithm

1. `assertChangeName`; resolve branch (default = change).
2. Resolve repo cwd (primary / resolveRepoContext). **Worktree need not exist** (merge operates on remote PR; `where` not_found is OK).
3. Find PR for head = branch via `gh pr list --head <branch> --state open` (or view).
   - None open: if a merged PR exists for that head → `action: already_merged` success; else error `pr_not_found` (or `not_found`).
4. **Checks gate:** run `gh pr checks <n>` (JSON if available).
   - Proceed only when gh reports checks in a **fully passing** state (align with `gh pr checks` exit 0 / all buckets pass).
   - Pending, failing, or indeterminate → error `checks_failed` (hard block). Do not invent per-check policy beyond gh’s pass/fail.
5. `gh pr merge <n>` with default `--squash` (or `--merge` / `--rebase` from `--method`). Invalid method → `usage`.
6. Return result; human/JSON hint only: next archive → finish → prune (do **not** run them).

### D3 — Checks hard gate details

- Prefer `gh pr checks --json` (or stable equivalent) + treat non-success aggregate as block.
- If gh cannot run or checks cannot be listed: **fail closed** (`pr_backend_unavailable` or `checks_failed`); never merge without a successful checks evaluation.
- v1: **no** `--admin` / skip-checks flag.

### D4 — Consent model

| Actor | Rule |
|---|---|
| Human CLI | Running `openspec-ops merge` is enough |
| Agent | May run merge **only** when user explicitly requested merge this turn (`/ops-merge` or clear “merge it”) |
| ship / impl-review | Still must not merge |

Skill MUST state: do not call merge after ship/impl-review unless user asked.

### D5 — Pluggable backend (optional thin)

v1 may call `gh` directly in `merge.ts` or extend ship’s gh module with `getChecks` + `mergePullRequest`. Prefer reuse of spawn/error patterns from `src/ship/backends/gh.ts`.

### D6 — Errors / JSON

| code | when |
|---|---|
| `pr_not_found` / `not_found` | no open PR for head |
| `checks_failed` | checks not all green |
| `already_merged` | optional success action or dedicated ok result |
| `pr_backend_unavailable` | gh missing |
| `git_failed` / `pr_failed` | merge command failed |

Result sketch:

```json
{
  "action": "merged" | "already_merged",
  "change": "...",
  "branch": "...",
  "method": "squash",
  "pr": { "number": 1, "url": "..." }
}
```

### D7 — Package / docs

- `.pi/skills/ops-merge/`, `.pi/prompts/ops-merge.md`
- package.json files list if explicit
- README loop + “only merge entrypoint”
- Update ops-ship / ops-impl-review skills one line: merge only via ops-merge when user asks

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Accidental agent merge | Skill hard rule; no auto policy |
| No second confirm | Document invoke=consent; checks gate |
| Checks flake | Hard block; human re-run after green |
| Method mismatch with repo rules | `--method`; default squash documented |

## Open Questions (resolved)

| Q | Decision |
|---|---|
| CLI + skill | Both |
| Method default | squash |
| Extra confirm | No |
| Checks | Hard block |
| Chain | No |

## Implementation sketch

```text
src/commands/merge.ts
src/ship/backends/gh.ts     # checks + merge helpers
src/cli.ts + types
.pi/skills/ops-merge + prompt
README + small ship/impl-review skill notes
tests: mocked gh checks fail/pass/already merged
```
