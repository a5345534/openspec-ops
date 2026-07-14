---
name: ops-ship
description: Commit change worktree, push branch, open GitHub PR via openspec-ops ship (no merge).
---

# /ops-ship

Commit **all** changes in the openspec-ops change worktree, push (no `--force`), open a PR with `gh`.

**Not** merge. **Not** archive. **Not** finish.

## Extension-bound runtime (first)

If current agent context contains `REQUIRED: openspec-ops binary is "..." (source=...)`, verify and use that exact safely quoted executable path first; the extension also exports it as `OPENSPEC_OPS_BIN`. Never concatenate the path into `sh -c`. Without a valid binding, use the fallback below.

## Binary

1. `$OPENSPEC_OPS_BIN` if set
2. `openspec-ops` on PATH
3. Else stop with install guidance

Always:

```bash
openspec-ops ship "<change>" [flags] --json
```

Require `schemaVersion === 1`. Use exit code + `error.code`.

## Flags

- `-m` / `--message` (default `ship(<change>): worktree`)
- `--title`, `--body`, `--draft`
- `--remote` (default origin), `--base`, `--backend` (default gh)

## Steps

1. Require change name.
2. Prefer consent if large/unexpected diffs.
3. Run ship with `--json`.
4. Report PR URL; on `submodule_detached_dirty` fix submodule first; on `pr_failed` after push, re-run after fixing `gh`.
5. After successful ship, offer `/ops-next <change>` — do **not** auto-run impl-review.

## Guardrails

- Do not merge PR unless user explicitly asks.
- Do not finish/archive as part of ship.
- Do not force-push.
- Impl-review only when the operator chooses it.
