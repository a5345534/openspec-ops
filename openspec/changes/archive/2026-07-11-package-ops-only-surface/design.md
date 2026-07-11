## Context

Pi package install loads broad globs including vendored `openspec-*` / `opsx-*`. Collision: first skill wins. CLI layer already clean.

## Goals / Non-Goals

**Goals:** ops-only package export; quarantine upstream copies; alignment without shadow skills; doctor/docs; automated export test; migration note.

**Non-Goals:** Delete vendor history entirely; upstream OpenSpec changes; default global `openspec` bin; **v1 thin `ops-propose` skill** (follow-up only).

## Decisions

### D1. Export allowlist (locked)

| Export | Allowed |
|---|---|
| `.pi/extensions/**` | yes |
| `.pi/skills/ops-*/**` | yes |
| `.pi/prompts/ops-*.md` | yes |
| `.pi/skills/openspec-*/**` | **no** in `pi.skills` |
| `.pi/prompts/opsx-*.md` | **no** in `pi.prompts` |
| `bin/openspec-ops`, `openspec-ops-intercept` | yes |
| `bin` key `openspec` | **never** |

`package.json` `pi` uses **allowlist globs**, not `**` over all skills/prompts.

### D2. Disk quarantine (locked)

Move (not delete) vendored assets:

```text
vendor/openspec-pi-ref/skills/openspec-*/...
vendor/openspec-pi-ref/prompts/opsx-*.md
```

- Not in `pi.skills` / `pi.prompts`
- Prefer not in npm `files` (or under a path clearly non-package-resource)
- Repo may keep them for human reference only

### D3. Worktree alignment without package openspec-propose (locked)

| Mechanism | v1 |
|---|---|
| Extension REQUIRED inject | yes |
| openspec-ops-intercept opt-in | yes |
| Doctor PATH / export checks | yes |
| `docs/snippets/worktree-alignment-block.md` | **yes** (consumer pastes into **their** skill) |
| Thin `ops-propose` skill | **no** (follow-up change if needed) |

### D4. Doctor changes (locked)

- **Remove** (or gate) check that **package root** must contain `.pi/skills/openspec-propose` with markers
- If checking markers: only when **consumer project** has that file (cwd/primary), not packageRoot of openspec-ops install
- Add/keep check: package manifest does not export openspec-/opsx- (test is source of truth; doctor may note ops-only surface in docs)

### D5. README / migration

- Pure sidecar; no second openspec-propose after install
- Migration: drop dependency on package-shadowed propose; use inject + intercept + snippet
- Intercept still opt-in alias

### D6. Verification

- Automated test on `package.json` `pi.skills` / `pi.prompts` allowlist
- Full suite green

## Risks / Trade-offs

- Alignment less “in the propose skill text from package” → intentional  
- Vendor dir still in monorepo → not loaded by Pi if not in pi.*  

## Migration Plan

1. package.json pi + files  
2. git mv openspec/opsx → vendor/openspec-pi-ref  
3. doctor decouple + snippet + README  
4. export-surface test  
5. consumer smoke note  

## Open Questions

- _(none — vendor path, no ops-propose v1, doctor decouple locked)_  

## Spike notes

- Pi name collision: first wins  
- AOS: project openspec-* + package openspec-* today  
