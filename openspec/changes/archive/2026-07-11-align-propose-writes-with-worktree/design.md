## Context

Issue #1: ensure creates `W`, propose writes primary. Agreed: **W-only** artifacts; **skill owns cwd**; **intercept reinforces CLI**; **docs + doctor + hard inject**.

## Goals / Non-Goals

**Goals:** W-only contract; skill marker block + fail-closed rules; extension REQUIRED inject; doctor PATH checks; visible no-name deferral; smoke/tests.

**Non-Goals:** Fork OpenSpec; auto-migrate dual trees; NL name derivation; default bin name `openspec`; Pi process chdir API dependency; v1 `/ops-propose` as sole entry (optional later).

## Decisions

### D1. Authority: `W/openspec/changes/C/` for active planning files

### D2. Responsibility split

| Layer | Duty |
|---|---|
| start/where | Create/locate `W` |
| **Propose/apply skills (package)** | where/start → cwd=`W` for openspec + change writes |
| Intercept | Opt-in ensure + child cwd on `new change` |
| Extension | Ensure on slash+name; REQUIRED inject; no-name defer notice |
| Doctor/docs | PATH/bin/intercept verification; update resilience |

### D3. When alignment is required (fail-closed)

**Alignment required** when both:

1. `openspec-ops` binary is resolvable, and  
2. `OPENSPEC_OPS_AUTO_START` is not `off`

Then, once change name `C` is known:

- Must `where` or `start`; on hard failure → **stop** (do not silent primary scaffold)
- On success → all openspec CLI + `openspec/changes/C` writes use cwd `W`

**Alignment not required** when `OPENSPEC_OPS_AUTO_START=off` **or** ops bin unresolvable:

- May continue on primary **only with an explicit warning** that worktree alignment is skipped

No separate env in v1 (reuse `AUTO_START` as opt-out). Optional future: `OPENSPEC_OPS_REQUIRE_WORKTREE`.

Apply skill: if `where C` succeeds, prefer cwd `W`; if alignment required and where fails mid-apply, warn or stop per same rule (prefer stop for writes under `openspec/changes/C`).

### D4. Skill edits + `openspec update` resilience

- Edit package `.pi/skills/openspec-propose/SKILL.md` and `.pi/prompts/opsx-propose.md` (and apply counterparts)
- Wrap ops-specific steps in:

```text
<!-- openspec-ops:worktree-alignment BEGIN -->
... where/start, cwd=W, fail-closed rules ...
<!-- openspec-ops:worktree-alignment END -->
```

- Doctor or docs: after `openspec update`, warn if marker block missing from propose skill
- **Not v1 primary:** new `/ops-propose` shell only (may add later as convenience)

### D5. Extension hard inject after ensure ok

REQUIRED absolute `W`; must not claim process cwd switched.

### D6. No-name propose

No ensure; notify alignment waits for name / `new change` / intercept.

### D7. Doctor

- ops bin resolvable (error/warn)
- If `openspec` realpath does not look like intercept → info/warn when documenting ensure-before-scaffold
- Note `OPENSPEC_REAL_BIN` when intercept expected

### D8. Dual-tree

Warn only; no auto-migrate.

### D9. changeDirExists

Docs: success = change under worktree path, not primary-only fallback. Optional later doctor `artifacts_on_primary_only`.

## Risks / Trade-offs

- Marker block can still be deleted by careless update → doctor warn  
- Fail-closed blocks propose when start broken → correct; `AUTO_START=off` escape  
- Upstream-only consumers → intercept + docs  

## Migration Plan

1. Skill/prompt marker blocks  
2. Extension inject + no-name notice  
3. Doctor + README  
4. Smoke/tests  
5. Close issue #1  

## Open Questions

- _(none — fail-closed and skill strategy locked)_  

## Spike notes

- Skill-level cwd on tool invocations is portable without Pi chdir  
- Real repos with `openspec/` on the branch are the target for worktree scaffold  
