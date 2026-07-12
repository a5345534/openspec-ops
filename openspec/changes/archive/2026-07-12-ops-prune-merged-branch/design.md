## Context

Product decisions (explore):

| Decision | Choice |
|---|---|
| Scope | Local **and** remote branch delete |
| Merged definition | **PR merged** (gh), not ancestor-only |
| Placement | **Independent** command (not finish default) |
| Target | **Single** change name only |
| Unmerged | **Never** delete (no force path in v1) |

Today: `finish` removes worktree only; `branchDeleted` always false. `ship` uses pluggable sync `PrBackend` with gh for create/reuse.

## Goals / Non-Goals

**Goals:**
- Explicit `prune <change>` after merge + finish.
- Gate on merged PR for head branch = change branch (default branch naming).
- Delete local then remote (or report partial with clear JSON); refuse if not merged.
- Refuse if worktree still registered for change.
- Reuse gh availability patterns from ship.

**Non-Goals:**
- Bulk `--all` / repo-wide sweep.
- Force delete unmerged (`-D` / ignore PR).
- Changing finish default to delete branches.
- Auto-prune on archive, ship, or merge webhook.
- Implementing GitHub “auto-delete head branches” repo setting (document as complementary).
- Non-gh backends in v1 (interface may allow later, like ship).

## Decisions

### D1 — Command shape

```text
openspec-ops prune <change>
  [--remote <name>]     # default origin
  [--branch <name>]     # default = change (same as lifecycle)
  [--json] [--repo PATH]
```

No `--force` for unmerged delete in v1.

### D2 — Preflight order and git cwd

All git/gh invocations for prune use **`resolveRepoContext` primary / repo `cwd`** (same as finish/start), not a missing worktree path.

1. `assertChangeName`
2. Resolve expected worktree path/branch (same defaults as where).
3. If worktree **registered** (path or branch match in `git worktree list`) → error `worktree_exists` — message: run finish first.
4. Query merged PR for head = branch via backend.
5. If not merged → error `branch_not_merged` (stable code).
6. Delete local branch with **`git branch -d` only** (never `-D` in v1).
   - If PR is merged but `-d` fails (common after squash: tip not ancestor of main): **fail** with `git_failed` and a message that manual `git branch -D` is operator choice — openspec-ops will not force-delete.
7. Delete remote: `git push <remote> --delete <branch>` (no force).
8. JSON result with flags for what was deleted.

**Idempotent absences (success):**
- Local already absent → `local.alreadyAbsent: true`, continue remote.
- Remote already absent (e.g. GitHub auto-delete head branches) → `remoteBranch.alreadyAbsent: true`, still success if local side ok.
- Both absent + merged PR verified → `action: already_clean`.

**Partial failure:** non-zero if a side still exists and delete errored.

### D3 — PR merged detection (gh)

```text
gh pr list --head <branch> --state merged --json number,url,baseRefName,mergedAt --limit 1
```

- **v1 head match:** local branch name only (e.g. `ops-ship`). Fork-style `user:branch` heads are out of scope unless later extended.
- Any merged PR with that head → allow prune.
- **Base need not be strictly `main`** in v1. Document that typical base is main.
- Open-only PRs → not sufficient.
- No PR / only open → `branch_not_merged`.
- Missing gh → `pr_backend_unavailable`.

### D4 — Sync backend surface

Extend or add:

```ts
interface MergeStatusBackend {
  id: string;
  findMergedPullRequest(input: {
    cwd: string;
    head: string;
  }): { number: number; url: string; baseRefName?: string } | null;
}
```

v1: implement on gh module alongside ship’s createOrReuse (shared `runGh` helper if easy). Ship’s create path unchanged.

### D5 — JSON result

```json
{
  "action": "pruned" | "already_clean",
  "change": "...",
  "branch": "...",
  "remote": "origin",
  "mergedPr": { "number": 1, "url": "..." },
  "local": { "deleted": true, "alreadyAbsent": false },
  "remoteBranch": { "deleted": true, "alreadyAbsent": false }
}
```

### D6 — Error codes

| code | when |
|---|---|
| `worktree_exists` | registered worktree for change still present |
| `branch_not_merged` | no merged PR for head |
| `pr_backend_unavailable` | gh missing |
| `git_failed` | branch -d or push --delete failed while ref still exists |
| `not_found` | optional: if we require branch to have existed somewhere — prefer still run merge check first; if no local/remote and no merged PR → `branch_not_merged`; if no local/remote but merged PR → `already_clean` |

Exit mapping: worktree_exists / branch_not_merged → 3; not_found → 5; git/pr backend → 10; align with existing table.

### D7 — Package / docs

- Skill `ops-prune` + prompt; globs already `ops-*`.
- README: loop `… → finish → prune`; never before merge; finish unchanged.
- Skills hard rule: only via CLI prune after merge, not ad-hoc `-D`.

### D8 — Relationship to finish / ship

```text
ship   → open PR (branch lives)
merge  → on GitHub (human/gh)
archive→ OpenSpec only
finish → remove worktree, keep branch
prune  → delete local+remote if PR merged
```

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Squash merge / ancestor false | PR state only |
| Delete while wt exists | Hard refuse |
| Remote delete needs auth | Clear git_failed / gh errors |
| Branch renamed vs change name | `--branch` override |
| Merged PR but local has extra commits | `-d` may fail → surface error, no `-D` |

## Open Questions (resolved for v1)

| Q | Decision |
|---|---|
| Local + remote | Both |
| Merged = | PR merged via gh |
| Command | Independent `prune` |
| Bulk | No |
| Force unmerged | No |
| PR base must be main? | No — any merged PR for head |
| Squash + `branch -d` fails | Fail with guidance; **no** `-D` in v1 |
| Remote already auto-deleted | Success (`alreadyAbsent`) |
| git/gh cwd | Repo primary / resolveRepoContext.cwd |
| ops-ship delta | Not required (boundary is docs in loop only) |

## Implementation sketch

```text
src/ship/backends/gh.ts     # add findMergedPullRequest (or src/prune/)
src/commands/prune.ts
src/cli.ts + types
.pi/skills/ops-prune + prompt
README
tests/prune.test.ts (injected deps)
```
