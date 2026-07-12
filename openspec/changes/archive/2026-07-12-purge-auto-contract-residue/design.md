# Design: purge-auto-contract-residue

## Principles

1. **One story**: runtime already guided; contracts must not resurrect AUTO_* as live knobs.
2. **Archive stays**: historical changes under `openspec/changes/archive/` untouched.
3. **Rename over alias** for extension file; document old name as removed.

## L1 — Alignment without AUTO_START

### Replacement policy

| Situation | Alignment |
|---|---|
| `openspec-ops` resolvable and operator has / creates a change worktree via start | **Use worktree path** for change artifacts and implementation |
| No worktree and operator did not start | **Warn**; may continue on primary only with explicit warning (same fail-open as old AUTO_START=off) |
| `openspec-ops` not resolvable | Alignment not required; warn |

Do **not** read `OPENSPEC_OPS_AUTO_START`.

### Spec edits

- MODIFIED requirements in `worktree-write-alignment` that name AUTO_START
- MODIFIED any `worktree-loop-closure` requirement that conditions apply-intent ensure on AUTO_START
- Grep main specs (non-archive) for `OPENSPEC_OPS_AUTO_` and clear or reword

## L2 — Rename extension

```text
.pi/extensions/openspec-ops-auto-ensure.ts
  → .pi/extensions/openspec-ops-guided.ts
```

- Update README references (“name historical” → new name)
- No runtime import of old path
- package.json description rewrite

## L3 — pi-auto-* hygiene

**Chosen approach:** Keep four short retired stubs **or** merge into one `retired-auto-lifecycle/spec.md` and remove the four directories if OpenSpec allows capability removal via empty/REMOVED.

Practical v1:

1. Ensure each `pi-auto-*` purpose line is unmistakably retired (already mostly true)
2. Remove any requirement body that still names env vars as if configurable **except** one line “env vars removed; do not set”
3. README: table “Retired capabilities (no runtime)” listing the four names → see guided-next-step

If consolidating is painful for openspec validate, keep stubs + README map only.

## Docs / vendor

| Path | Action |
|---|---|
| `docs/snippets/worktree-alignment-block.md` | Match L1 wording |
| `vendor/openspec-pi-ref/**` | Replace AUTO_START gates with explicit start / warn language; note sample may lag consumer openspec update |

## Verification

```bash
rg 'OPENSPEC_OPS_AUTO_' --glob '!openspec/changes/archive/**' --glob '!node_modules/**'
# expect: only retired stubs / explicit "removed" prose, or zero
test ! -f .pi/extensions/openspec-ops-auto-ensure.ts
test -f .pi/extensions/openspec-ops-guided.ts
```

## Risks

- Consumers bookmarked old extension path
- Over-deletion of pi-auto stubs confuses “what was removed” narrative — mitigate with README retired table
