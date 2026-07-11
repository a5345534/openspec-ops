## Context

Locked delivery order:

```text
ensure → propose@W → review(plan) → apply@W
  → ship/PR (future) → review(code) → merge
  → archive → finish
```

**Default: merge before archive.** Ship automation is a separate change.

Gaps this change closes: apply gate, archive cwd decision tree, dirty finish messaging, doctor, loop docs.

## Goals / Non-Goals

**Goals:** Apply gate; archive decision tree (docs + light handoff); finish dirty copy; doctor; README.

**Non-Goals:** ops-ship; archive-before-merge mode; auto-migrate dual trees; openspec-* package skills; auto force-finish dirty; blocking primary archive after merge.

## Decisions

### D1. Scope = path binding + finish policy + docs (not ship)

### D2. Apply intent gate

- Slash: `/opsx-apply`, `/opsx:apply`
- Kebab name + alignment required (`ops` resolvable, `AUTO_START` ≠ `off`) → where/start → REQUIRED inject `W`
- No name → deferred notice, no false ensure
- Continue stock apply; no process chdir claim

### D3. Archive cwd decision tree (locked)

```text
if where(C) ok AND changeDir path is under worktree W
  AND team is still pre-merge (change active on branch):
    → prefer handoff: use W for archive-related openspec ops
else if following default loop after merge into main:
    → archive on mainline checkout (often primary) holding openspec/specs
    → do NOT require W; do NOT fail archive on primary
else:
    → docs only / soft guidance
```

**v1 implementation:**

- Docs: primary happy path = merge then archive on mainline checkout; then finish W
- Extension optional: `/opsx-archive <name>` → where; if changeDir under W, REQUIRED prefer W; **never** abort primary archive solely because a worktree also exists
- No automation of archive-before-merge

### D4. Post-archive finish

Dirty skip message:

```text
Skipped auto-finish: worktree dirty.
Next: commit/push/PR (ops-ship when available), or
  openspec-ops finish <change> --force  (explicit consent only)
```

No git commit/merge/push from finish.

### D5. Doctor

- Existing env checks retained
- Add when feasible: dirty wt + no active change (leftover)
- Optional: artifacts_on_primary_only

### D6. pi-ops-skills

Update package **ops-*** apply skill/prompt markers for where.path only (package already ops-only surface).

## Risks / Trade-offs

- Apply without name stays weak  
- Merge must bring change artifacts to main for mainline archive — document  
- Dirty finish remains manual until ops-ship  

## Migration Plan

1. Apply gate + archive handoff rules  
2. Finish message + doctor  
3. README loop  
4. Tests for apply-intent parse  
5. Follow-up: ops-ship  

## Open Questions

- _(none)_  

## Spike notes

- Finish = worktree remove only  
- Merge-then-archive avoids specs-on-main without code when archive is done on wrong tree  
