## Context

openspec-ops already provides:

- CLI: `start` / `where` / `finish` / `doctor` with stable JSON
- Pi skills/prompts `ops-*` that teach the agent to call the CLI
- Main specs: `workspace-lifecycle`, `pi-ops-skills`

Exploration decided daily UX should not require explicit `/ops-start`. Instead the harness detects OpenSpec propose intent, ensures a workspace, then **releases** the original propose flow unchanged.

Pi extension ordering (relevant):

1. Extension commands  
2. `input` event (async; can continue / transform / handled)  
3. Skill / prompt expansion (`/opsx-propose`)  
4. `before_agent_start`  
5. Agent loop  

Ensure must complete **before** step 3 when policy is on.

## Goals / Non-Goals

**Goals:**

- Default-on auto ensure before propose for parseable change names
- Zero changes to OpenSpec propose semantics/steps
- Deterministic execution via `openspec-ops … --json` only
- Disable with policy `off`
- Explicit ops-start remains available

**Non-Goals:**

- Auto ensure on explore/apply/archive
- NLP on free-form chat as primary trigger (L1 = slash strong signals only)
- Rewriting or replacing `/opsx-propose` prompt body
- Auto finish/archive/commit/PR
- Changing CLI contract

## Decisions

### D1. Trigger = harness detect, not OpenSpec fork

- Intercept at Pi `input` (or equivalent that runs before prompt expand)
- Match strong signals only, e.g. `/opsx-propose`, `/opsx:propose`
- Parse first token as change name if kebab-case; else **no ensure**, continue propose
- On success: `{ action: "continue" }` so the **same** user text expands stock opsx-propose
- On ensure hard failure: do not continue agent; notify error (treat as handled/cancel path)

### D2. Policy default `on`

```
OPENSPEC_OPS_AUTO_START=on|ask|off
default: on
```

| Value | Behavior |
|---|---|
| `on` | Silent ensure (notify optional non-blocking) |
| `ask` | Confirm only when worktree must be created (not when where hits) |
| `off` | No intercept side effects |

CLI does not read this env; extension only.

### D3. ensureWorkspace algorithm

```
where --json
  found → bind state, return ok (silent)
  not_found →
    ask? confirm create
    on? start --json
    start ok → bind state
    start fail → abort propose
```

Reuse path: no user prompt even under `ask`.

### D4. OpenSpec flow integrity

- Do not edit `.pi/prompts/opsx-propose.md` to embed start steps as the automation mechanism
- Do not reimplement propose in the extension
- Acceptance: with policy `off` or extension disabled, behavior matches stock OpenSpec

### D5. Binary resolution

Same as ops skills:

1. `OPENSPEC_OPS_BIN`  
2. `PATH` (`openspec-ops`)  
3. Project `bin/openspec-ops` if present relative to extension/project root  
4. Else fail ensure with clear notify  

### D6. Post-ensure path awareness

- `ctx.ui.notify` workspace path on create/reuse (lightweight)
- Optional `before_agent_start` inject one short line: prefer artifacts under `path`
- Do not block propose solely because session cwd cannot switch (spike if API allows cwd change later)

### D7. Optional registerCommand for explicit ops-*

- May register `/ops-start` etc. as deterministic runners (same CLI)
- Must not break auto-ensure-on-propose if both exist
- If command registration steals `/opsx-propose` name, only acceptable if handler ensures then **invokes the same prompt expansion path**—prefer pure `input` continue to avoid reimplementing propose

### D8. Layout

```text
.pi/extensions/openspec-ops-auto-ensure.ts
  # or openspec-ops.ts bundling ensure + optional commands

src/  # optional: if tests need pure functions, extract parse/ensure helpers
```

Prefer thin extension file calling CLI; extract pure parse/policy helpers for unit tests without full Pi runtime if practical.

## Risks / Trade-offs

- **[Risk] Agent still writes change on primary after ensure** → notify + context inject; optional later write guard  
- **[Risk] input handler timing/order with other extensions** → keep handler fast; only await openspec-ops  
- **[Risk] False positive on “propose” in prose** → slash-only matching  
- **[Risk] registerCommand steals propose and forks flow** → prefer continue-after-ensure; document  
- **[Trade-off] default on may surprise users who want primary-only proposes** → document `off`; reuse is cheap  

## Migration Plan

1. Land extension under `.pi/extensions/`  
2. Document env policy and default `on`  
3. `/reload` Pi in this project  
4. Smoke S1–S5 from design tests  
5. Rollback: remove/disable extension or set `off`  

## Open Questions

- Exact Pi API for canceling propose after failed ensure (`handled` vs throw)—resolve during implement against installed pi version  
- Whether project settings file is needed beyond env in this change (prefer env-only for v1)  

## Spike notes (implementation)

Pi processing order (docs/extensions.md):

1. Extension commands  
2. `input` event (async handlers awaited)  
3. Skill / prompt expansion (`/opsx-propose`)  
4. Agent loop  

**Conclusion:** An async `input` handler that awaits `openspec-ops` ensure and then returns `{ action: "continue" }` runs **before** `/opsx-propose` prompt expansion. Failed ensure returns `{ action: "handled" }` so propose does not proceed. No need to rewrite `opsx-propose.md`. Env-only policy for v1.  
