# Design: guided-lifecycle-no-auto

## Goals

1. Zero cross-step automatic skill scheduling.
2. Operator picks next step via select UI or text menu after each station completes.
3. Delete auto-* code and env surface entirely.
4. Hard-coded legal edges only.

## Architecture

```text
  ops skill completes
         │
         ▼
  suggestNextStep(change)     ← pure module (testable)
         │
         ├─ hasUI → ctx.ui.select(title, labels)
         └─ !hasUI → print numbered menu; stop (no followUp)
         │
         ▼
  user choice → run corresponding slash/skill only if chosen
```

### Modules

| Path | Role |
|---|---|
| `src/next-step/stations.ts` | Detect station from where/tasks/gh/archive signals |
| `src/next-step/edges.ts` | Hard-coded `Record<Station, NextOption[]>` |
| `src/next-step/menu.ts` | Format text menu; map choice → slash command |
| `src/next-step/index.ts` | Public API |
| `.pi/skills/ops-next/` | Skill: run detection + present menu + execute choice instructions |
| Extension | Optional: register `/ops-next`; **no** auto settle fire for review/finish/ensure |

Logic that was useful from auto-review (e.g. tasks checkbox summary) may be **moved** into `next-step` or `lifecycle` under non-auto names—not kept as `src/auto-review`.

## Stations and edges (hard-coded)

### Stations

| Station | Detection sketch |
|---|---|
| `no_workspace` | `where` → not_found |
| `ready_to_propose` | worktree exists; no `proposal.md` (or empty change dir) |
| `proposed` | `proposal.md` present; not all tasks complete (or no tasks yet); not shipped |
| `applied` | tasks all complete; no open PR for branch (or never shipped) |
| `shipped` | open PR for change branch |
| `merged` | merged PR; active change dir still present (not archived) |
| `archived` | archive exists for change; worktree may still exist |
| `done` | archived (or no active) and worktree absent |

Detection SHOULD prefer CLI JSON (`where`, filesystem under change roots, `gh` via existing merge-status helpers) and MUST degrade safely (unknown → minimal menu: stop + common manual slashes only if needed). Prefer **narrow menus** over wrong options.

### Edges (main menu)

| From | Options |
|---|---|
| `no_workspace` | `ops-start`, stop |
| `ready_to_propose` | `opsx-propose`, stop |
| `proposed` | `ops-spec-review`, `opsx-apply`, stop |
| `applied` | `ops-ship`, stop |
| `shipped` | `ops-impl-review`, `ops-ship`, `ops-merge`, stop |
| `merged` | `opsx-archive`, stop |
| `archived` | `ops-finish`, stop |
| `done` | stop |

**Explicitly excluded from main menu:**

- `applied` → `ops-spec-review`
- ensure / auto-start
- prune
- merge → finish (skip archive)
- any automatic edge without select/text choice

**Expert path:** operator may still type `/ops-spec-review` manually when applied; skill phase rules apply; guided menu does not advertise it.

### shipped → ship again

After impl-review (push fixes) or new local work, station remains `shipped` while PR open. Menu includes `ops-ship` so re-packaging the worktree is first-class. impl-review may still push without ship; both remain valid.

## UI contract

```text
if ctx.hasUI && typeof ctx.ui.select === "function":
  choice = await ctx.ui.select(`Next for ${change}`, labels)
else:
  print text menu
  do not schedule follow-up turns
  return
```

- Cancel / dismiss → stop
- Never default to first option on cancel
- Never `sendUserMessage(..., followUp)` for next skill unless the **current user turn** explicitly selected that action (or user typed the slash)

## Skill integration

Each lifecycle skill (start, propose handoff, apply, ship, impl-review, merge, archive, finish) **ends** with:

1. Brief success summary  
2. Instruction to run `/ops-next <change>` **or** embed the same menu helper if running inside Pi with UI  

Ship skill: **remove** “unless AUTO_IMPL_REVIEW=off, run impl-review”.  
Propose path: **remove** ensure + review arm.

## Deletion plan

1. Remove packages of auto code + tests.  
2. Gut extension to guided-only (or delete auto handlers).  
3. Update README, doctor env checks, package export tests.  
4. Spec deltas: REMOVED for pi-auto-* requirements; ADDED guided-next-step; MODIFIED loop/skills docs.  
5. Intercept: remove ensure-before-new-change; either delete intercept binary surface or leave passthrough-only with no ensure (prefer no ensure).

## Risks

| Risk | Mitigation |
|---|---|
| Users forget `/ops-start` | Menu from `no_workspace`; README warning |
| Station mis-detect | Conservative options; always include stop; tests with fixtures |
| Headless agents expect auto | Document breaking change; text menu only |
| Large diff | Single change; tasks ordered delete → add → wire skills |

## Alternatives rejected

- Default all AUTO_*=off only — machinery remains, still surprise if re-enabled  
- Configurable edges file — out of scope; hard-coded by product decision  
- Keep auto-ensure as ask-once — user requested ensure removed entirely  
