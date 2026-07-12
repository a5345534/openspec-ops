# Change: purge-auto-contract-residue

## Why

`guided-lifecycle-no-auto` removed auto **runtime**, but contracts and branding still describe the old world:

- Main specs (`worktree-write-alignment`, parts of `worktree-loop-closure`) still gate alignment on `OPENSPEC_OPS_AUTO_START`
- `pi-auto-*` capabilities remain as retired stubs under auto-named paths
- Extension file still named `openspec-ops-auto-ensure.ts`; `package.json` description still markets ensure/review/finish auto
- `vendor/openspec-pi-ref` and docs snippets still mention `OPENSPEC_OPS_AUTO_*`

Readers and archive sync treat these as live contracts. Residue must be purged so **code, specs, and docs tell one story**: explicit start + guided `/ops-next`.

## What Changes

### L1 — Spec contract alignment (required)

- Rewrite `worktree-write-alignment` so required alignment is **not** defined by `OPENSPEC_OPS_AUTO_START` (env removed). Also MODIFIED related requirements that still say “auto-ensure” handoff / README “AUTO_START=off” (extension path constraint after **explicit** start; doctor/docs scenarios).
- Update `worktree-loop-closure` (and any other main specs) that still cite `OPENSPEC_OPS_AUTO_START` as a live switch
- Strip remaining live references to `OPENSPEC_OPS_AUTO_REVIEW` / `AUTO_FINISH` / `AUTO_IMPL` outside historical archive and explicit “retired” wording if still needed briefly

### L2 — Naming and package surface

- Rename Pi extension file to a guided name (e.g. `openspec-ops-guided.ts` or `openspec-ops-lifecycle.ts`); update any load paths/docs
- Update `package.json` description to guided lifecycle (start, next-step, ship/merge/finish) without auto-follow-up marketing
- Clean stale comments (e.g. `ops-runtime/run-ops.ts` auto-ensure path notes)

### L3 — Spec directory hygiene (in scope)

- Collapse or clearly rehome retired `pi-auto-*` main specs so they are not mistaken for active product capabilities (options in design: single `retired-auto-lifecycle` capability, or keep stubs with stronger “DO NOT IMPLEMENT” purpose + README map)
- Prefer not deleting archive history

### Docs / vendor

- Update `docs/snippets/worktree-alignment-block.md` to match L1
- Update or mark obsolete `vendor/openspec-pi-ref` propose/apply AUTO_START language

## Capabilities

### Modified Capabilities

- `worktree-write-alignment`: remove AUTO_START-based required/optional gate; align with explicit start + guided flow
- `worktree-loop-closure`: remove live AUTO_START coupling for apply-intent alignment
- `pi-package-ops-surface` / package docs if description is specified there
- `guided-next-step` or `pi-ops-skills`: mention extension rename if packaged
- `pi-auto-*`: further retire / consolidate (REMOVED remaining auto-env language or replace with single retired capability)

### New Capabilities (optional)

- `retired-auto-lifecycle` only if consolidating stubs into one capability

## Impact

- Spec-only + rename + docs; no return of auto fire
- Possible break for external docs that still tell users to set `OPENSPEC_OPS_AUTO_START`
- Extension consumers must load new filename if hardcoded

## Non-goals

- Reintroducing any auto ensure/review/finish/impl-review
- Changing `/ops-next` edge table
- Rewriting all archive/ history under `openspec/changes/archive/`
