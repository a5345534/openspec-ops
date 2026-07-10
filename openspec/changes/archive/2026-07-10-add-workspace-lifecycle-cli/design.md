## Context

OpenSpec documents a team everyday loop that starts with `git switch -c <change>` and ends with archive after merge, but the tool never performs git operations. `openspec-ops` is a sidecar project whose near-term goal is to automate only the workspace side of that loop.

Exploration on this machine found a de facto convention already in use across several repos:

- Linked worktrees live at `<primary>/.worktrees/<slug>`
- `.worktrees/` is gitignored
- Branch names often carry a prefix (`feat/`, `openspec/`, `change/`, `goal/`), but OpenSpec's own docs use the bare change name

Phase 0 freezes a small CLI contract: `start` / `where` / `finish` / `doctor`, change-name as primary key, no OpenSpec semantic coupling, no harness lock-in. Skills and Pi hooks come later and must shell out to this CLI.

## Goals / Non-Goals

**Goals:**

- Deliver a manually invocable, harness-neutral CLI named `openspec-ops`
- Map `change` → default `branch` + worktree `path` by convention
- Guarantee idempotent `start` and safe `finish` (keep branch; refuse dirty unless `--force`)
- Provide stable `--json` output (`schemaVersion: 1`) and exit codes for agents
- Keep the official OpenSpec propose/apply/archive flow untouched

**Non-Goals:**

- Wrapping or replacing `/opsx:*` commands
- Commit, push, PR, merge, or archive automation
- Orca (or any IDE) as a required backend
- Nested worktrees as default behavior
- Sidecar binding files or project config files in Phase 0
- Short binary alias `ops` on PATH
- Auto-start via Pi hooks

## Decisions

### D1. Binary name and surface

- **Choice:** Formal command `openspec-ops` only; subcommands `start`, `where`, `finish`, `doctor`
- **Why:** Avoids PATH collisions; skills call the full name
- **Alternatives:** `ops` short name (rejected for Phase 0); combine into OpenSpec core (rejected—OpenSpec must not touch git)

### D2. Implementation language

- **Choice:** TypeScript (Node), runnable via a thin `bin` entry (e.g. `tsx` in dev, compiled or node shebang for install)
- **Why:** Matches the local Pi/OpenSpec-adjacent ecosystem; easy JSON CLI; good test tooling
- **Alternatives:** Pure bash (fastest spike, weak structure as it grows); Python (fine, but this repo is not yet a Python package and Pi adapters are TS)

### D3. Identity and defaults

| Field | Default | Override |
|---|---|---|
| `change` | required arg | — |
| `branch` | `<change>` | `--branch` |
| `path` | `<primary>/.worktrees/<change>` | `--path` |
| `base` | `origin/HEAD` → local `main`/`master` | `--base` |

- **Why:** Bare branch matches official OpenSpec team-workflow; path matches this machine's dominant convention
- **Alternatives:** Always `openspec/<change>` prefix (team preference → use `--branch`); sibling directories outside repo (less common here)

Change name validation: `^[a-z0-9]+(?:-[a-z0-9]+)*$`.

### D4. Binding model: convention only

- **Choice:** No sidecar state file. Resolve by expected path first, then by expected branch in `git worktree list`
- **Why:** Zero pollution of `openspec/changes/`; enough for Phase 0; doctor reports drift
- **Alternatives:** `.ops-workspace.json` per change (deferred); external registry under `~/.config` (deferred)

### D5. Primary worktree anchoring

- **Choice:** Always create new worktrees under the **primary** checkout's `.worktrees/`, not under cwd when cwd is already a linked worktree
- **Why:** Avoid accidental nesting; nested worktrees exist in the wild but are an advanced opt-in later
- **How:** Resolve `git rev-parse --show-toplevel` / worktree list / common dir to find primary path

### D6. `start` semantics

```
if path is correct worktree for branch → reused (exit 0)
if path missing and branch free or missing → create branch if needed, worktree add
if path missing and branch checked out elsewhere → branch_busy
if path exists but wrong → conflict
```

- Never moves primary HEAD
- Never calls `openspec new change`
- Reusing an existing branch does **not** reset it to `base` (optional warning only if we add warnings later; Phase 0 may omit freshness warnings)

### D7. `finish` semantics

- Remove worktree only; **never** delete branch in Phase 0
- Dirty worktree → exit 4 unless `--force`
- Does not run archive

### D8. `where` semantics

- Strict: not found → exit 5 (no `--allow-missing` in Phase 0)
- Success JSON always has `found: true`
- Dirty := non-empty `git status --porcelain=v1`

### D9. `doctor` semantics

- Read-only; exit 0 if checks ran (even with warning/error issues), exit 2 if not a git repo
- No `--strict`, no `--fix`
- Emit `worktrees[]` inventory + minimal issues:
  - `stale_worktree_dir` (warning)
  - `missing_worktree_path` (error)
  - `worktree_without_change_dir` (info, skip if no openspec tree)

### D10. Output and exit codes

**JSON envelope (when `--json`):**

```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "start",
  "result": {}
}
```

or

```json
{
  "schemaVersion": 1,
  "ok": false,
  "command": "start",
  "error": {
    "code": "path_occupied",
    "message": "...",
    "details": {}
  }
}
```

- `--json`: stdout is only that object; logs go to stderr if any
- Human mode: short status; for path-bearing commands, **last stdout line is the path**

| Exit | Meaning |
|---|---|
| 0 | success (including start reuse; doctor with issues) |
| 1 | usage / invalid_change_name |
| 2 | not_a_git_repo / base_unresolved / primary_unresolved |
| 3 | conflicts (path_occupied, path_not_worktree, branch_busy, branch_mismatch, ambiguous) |
| 4 | worktree_dirty |
| 5 | not_found |
| 10 | git_failed / internal |

### D11. Layout in this repo

```text
openspec-ops/
  package.json
  bin/openspec-ops          # entry
  src/
    cli.ts                  # argv parse, dispatch
    git.ts                  # git wrappers
    resolve.ts              # primary, base, path/branch defaults
    commands/
      start.ts
      where.ts
      finish.ts
      doctor.ts
    types.ts                # JSON result types
  tests/
    fixtures/               # temp git repos
    *.test.ts
  README.md                 # update with CLI usage + loop mapping
```

### D12. Testing strategy

- Integration tests against temporary real git repos (init, commit, worktree add)
- Cover scenarios S1–S8 from the frozen contract (happy path, reuse, branch busy, path occupied, dirty finish, start-from-linked-wt, not a repo, where not found)
- Do not require network or OpenSpec CLI for unit/integration of workspace ops

### D13. Later harness adapters (out of Phase 0 code, noted for boundary)

- Skills/Pi commands MUST invoke `openspec-ops … --json` and MUST NOT reimplement `git worktree`
- Pi hooks may only read status (where/doctor), never auto `start`/`finish`

## Risks / Trade-offs

- **[Risk] Bare branch names collide with team prefix conventions** → Mitigation: `--branch` override; future optional project config (not Phase 0)
- **[Risk] Convention binding drifts (renamed dirs, manual worktrees)** → Mitigation: `where` dual lookup; `doctor` inventory; no silent destructive fix
- **[Risk] This repo currently sits under an accidental home-level git root** → Mitigation: tests use isolated fixtures; document that dogfood needs a proper repo root; optional task to `git init` this project separately
- **[Risk] `git worktree` behavior differs slightly by git version** → Mitigation: rely on porcelain `worktree list` + documented commands; pin minimum git in README if needed
- **[Trade-off] No config file keeps Phase 0 small** → teams with mandatory prefixes pass flags until Phase 0b
- **[Trade-off] finish keeps branches forever until human deletes** → safer than auto-delete; matches PR-oriented flow

## Migration Plan

1. Land CLI + tests in this repo; update README
2. Use manually: `openspec-ops start <change>` before `/opsx-propose`, `finish` after archive/cleanup
3. No migration for existing worktrees—they remain valid if path/branch match convention; otherwise addressable via `--path` / `--branch`
4. Rollback: stop calling the binary; workspaces are plain git worktrees

## Open Questions

- Exact package distribution (global npm link vs repo-local `pnpm exec`) — decide at implement time; default to repo-local bin + `package.json` bin field
- Whether human-mode should colorize — optional, non-blocking; JSON path is the agent contract
