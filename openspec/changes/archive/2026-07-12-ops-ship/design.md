## Context

openspec-ops lifecycle today: `start` / `where` / `finish` / `doctor`. Delivery after apply is manual. Product stance (close-worktree-loop, finish gates): **finish never commits or merges**. Ship is a separate explicit command.

User decisions for v1:
1. **Commit scope A:** entire worktree (all changes) — `git add -A` (or equivalent) under worktree path, one commit.
2. **PR backend:** GitHub CLI `gh` first; interface must allow swap (e.g. later GitLab/glab).
3. Open this change as `ops-ship`.

## Goals / Non-Goals

**Goals:**
- One command: resolve change worktree → commit all local changes → push → create PR.
- Stable JSON result: commit sha, branch, remote, pr url/number when available.
- Pluggable `PrBackend` with `gh` implementation.
- Submodule hygiene preflight: block or hard-warn when top-level submodule is detached+dirty (prefer **fail** ship for safety).
- Docs + ops-ship skill aligned with ops-* package surface.

**Non-Goals:**
- Auto-merge / merge queue / delete branch after merge.
- Amending others’ commits or interactive rebase.
- Partial path commit filters (B/C) in v1.
- Replacing `gh` auth UX (user must be logged in).
- Auto-ship on apply settle in v1 (env reserved; default off).
- Changing OpenSpec archive/propose/apply.

## Decisions

### D1 — Command shape

```text
openspec-ops ship <change>
  [--message|-m <msg>]
  [--title <pr title>]
  [--body <pr body>]
  [--draft]
  [--remote <name>]          # default origin
  [--base <branch>]          # default: primary default branch (main/master discovery)
  [--backend gh]             # default gh; only gh in v1
  [--allow-empty]            # optional: error by default if nothing to commit and no unpushed?
  [--json] [--repo PATH]
```

### D1b — State machine (v1)

| Worktree | Ahead of remote? | PR exists? | Action |
|---|---|---|---|
| dirty | * | * | preflight → `git add -A` + commit → push → createOrReuse PR |
| clean | yes | * | skip commit → push → createOrReuse PR |
| clean | no | yes | no commit/push needed → return existing PR (`action` e.g. `pr_exists`) |
| clean | no | no | create PR only (head already on remote) |
| clean | no | cannot detect / create fails with nothing to do | error `nothing_to_ship` |

**Push ok, PR fail:** overall exit **non-zero**; error details MUST note that push may have succeeded so a retry should **not** create a duplicate commit (worktree now clean). Operator re-runs ship to complete PR only.

**No force push** in any row.

### D2 — Commit message

- Prefer `--message` / `-m`.
- Default when omitted: **`ship(<change>): worktree`** (document in README).
- Never invent multi-commit split in v1.
- Default PR title when `--title` omitted: same string as commit message (or change name); body may be empty or a one-line stub.

### D3 — PR backend interface (sync)

Match existing CLI style (`spawnSync` / no async command layer):

```ts
interface PrBackend {
  id: string; // "gh"
  createOrReusePullRequest(input: {
    cwd: string;
    base: string;
    head: string;
    title: string;
    body: string;
    draft: boolean;
  }): { url: string; number: number; alreadyExisted?: boolean };
}
```

- v1 factory: only `gh` (spawn `gh pr create` / `gh pr view` / `gh pr list`).
- Missing `gh` → error `pr_backend_unavailable` with install hint.
- Unknown `--backend` → usage error.
- Design allows registering other backends later without changing ship orchestration.

### D4 — Policy env (reserved)

`OPENSPEC_OPS_AUTO_SHIP=off|ask|on`, default **`off`**.

- CLI `ship` always available when invoked explicitly.
- Extension auto-arm after apply is **out of v1 implementation** unless trivial; document reserved.

### D5 — JSON result (schemaVersion 1)

```json
{
  "action": "shipped" | "pushed" | "pr_only" | ...,
  "change": "...",
  "path": "...",
  "branch": "...",
  "remote": "origin",
  "base": "main",
  "commit": { "created": true, "sha": "...", "message": "..." } | null,
  "push": { "ok": true },
  "pr": { "url": "...", "number": 1, "backend": "gh", "draft": false }
}
```

### D6 — Exit / error codes

Reuse table where possible; add stable `error.code` values:
- `submodule_detached_dirty` → abort before commit (exit prefer 3 conflicts/state)
- `nothing_to_ship` → clean, synced, no PR work possible
- `pr_backend_unavailable` → gh missing
- `pr_failed` → push may have succeeded; details explain retry
- push rejected → `git_failed`
- worktree missing → `not_found`

### D7 — Package surface

- Skill `.pi/skills/ops-ship/SKILL.md` + prompt `.pi/prompts/ops-ship.md`
- Existing package.json globs (`ops-*/SKILL.md`, `ops-*.md`) **already export** new files — task is **verify**, not invent new pi config unless pattern changed
- No `openspec-*` skill names

### D8 — Submodules

Before `git add -A` on parent:
- Run top-level probe.
- If `detached && dirty` → **abort** ship (`submodule_detached_dirty`).
- If detached **clean** → **warn** in `result.warnings` (or human stderr), **continue** (v1).
- Attached dirty submodule: allow parent ship but document “prefer commit submodule first”.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `git add -A` commits secrets/junk | Document; future path filters; doctor later |
| Force-push needed after rebase | v1 no force; clear error |
| `gh` not installed | Explicit error + install hint |
| Double PR | `gh` create detects existing; return alreadyExisted |
| Auto-ship abuse | Default policy off; no apply hook in v1 |

## Open Questions (resolved)

| Q | Decision |
|---|---|
| Commit scope | Entire worktree (A) |
| PR tool | gh v1, pluggable **sync** interface |
| Default commit message | `ship(<change>): worktree` |
| Push ok / PR fail | Non-zero exit; retry completes PR only |
| Clean detached submodule | Warn, do not abort |
| Auto-merge | Never in this capability |

## Implementation sketch

```text
src/ship/pr-backend.ts       # interface
src/ship/backends/gh.ts      # gh adapter
src/commands/ship.ts         # orchestration
src/cli.ts + types           # wire command
.pi/skills/ops-ship + prompt
README loop + ship section
tests: unit backend mock + fixture ship happy path
```
