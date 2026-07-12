# Design: ops-next-pick-change

## Flow

```text
/ops-next [change?]
     │
     ├─ name given → station menu (existing)
     │
     └─ no name
            │
            ▼
        listCandidates(roots)
            │
            ├─ 0 → notify + stop
            ├─ 1 → change = that name
            └─ N → select change (ui.select | text)
            │
            ▼
        buildNextStepPlan(change) → select action (existing)
```

## Candidate discovery

Union of:

1. Linked git worktrees under primary `.worktrees/*` with inferable kebab leaf / branch name
2. Active dirs `openspec/changes/<kebab>/` under primary and cwd (skip `archive/`)
3. Optional: doctor `worktrees[].inferredChange`

Dedupe by change name. Sort stable (localeCompare).

Exclude:

- `archive/*` only (unless also active—then include as active name)
- Non-kebab leaves

## UI

| Case | hasUI select | headless |
|---|---|---|
| 0 candidates | notify | notify |
| 1 candidate | proceed (may still show “Using X” notify) | same |
| N candidates | `ui.select("Pick change", names)` | numbered text; **stop** until user re-runs `/ops-next <name>` OR allow second message—v1: print list + “run /ops-next <name>” without auto-continue |

**v1 headless multi:** do not parse free-text reply in extension; print list and stop (consistent with no silent follow-up).  
**v1 hasUI multi:** select then continue to action menu in same handler.

Cancel on change select → stop (no action menu).

## Implementation sketch

```text
src/next-step/discover-changes.ts  listCandidateChanges(roots) → string[]
.pi/extensions/openspec-ops-guided.ts  ops-next handler
.pi/skills/ops-next/SKILL.md
```

Reuse `CHANGE_NAME_RE`, `resolveOpsBin` + doctor JSON optional for richer list labels (`name (dirty)`).

## Risks

- Stale worktree dirs without openspec → still list if registered worktree (OK; station may be no_workspace/ready)
- Primary-only active change without worktree → still list (station drives next)
