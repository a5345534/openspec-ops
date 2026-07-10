## Context

openspec-ops already provides:

- CLI: `start` / `where` / `finish` / `doctor` with stable JSON (`schemaVersion: 1`), including `dirty` and `changeDirExists` on where
- Pi skills `ops-*` for **manual** orchestration
- Pi extension: auto-ensure before `/opsx-propose` (+ optional auto-review inject)
- Main specs: `workspace-lifecycle`, `pi-ops-skills`, `pi-auto-ensure-on-propose`

Review of the first draft found that **binding finish to “archive command + one-shot agent_settled” is wrong**: `/opsx-archive` is multi-turn, and `agent_settled` means “this agent run stopped,” not “OpenSpec archive completed.”

Correct product framing (user language): “after archive, clean up the worktree.”  
Correct technical framing: **reclaim orphan worktrees when a watched change is no longer active.**

Pi has no `openspec_archive_complete` event. Hooks are only generic (`input`, `agent_settled`, …). Business signal = **active → inactive** observed at check points.

## Goals / Non-Goals

**Goals:**

- Reclaim leftover worktrees when a change is **inactive** and the worktree is still registered and **clean**
- v1 **watch arm** from strong `/opsx-archive <kebab-name>` (intent accelerator, not completion signal)
- Check on `agent_settled` while watches exist (**sticky** until clear conditions)
- Policy **`ask` | `on` | `off`** with default **`ask`**; **`on` is required in v1**
- Extension + CLI main path; skills are manual/fallback only
- Never block OpenSpec archive (fail-open)
- Never auto `--force` / never finish when dirty

**Non-Goals:**

- Full-repo orphan scan of every worktree without a watch (may be phase 2)
- Infer change name when `/opsx-archive` has no args (v1 strict)
- `sendUserMessage("/ops-finish")` as automation main path
- Editing `opsx-archive.md` / OpenSpec archive semantics
- Branch delete, commit/PR/merge automation
- Free-form chat “archive” detection
- Rewriting workspace-lifecycle CLI contract

## Decisions

### D1. Bind to change active-state (orphan), not archive verb timing

**Finish-allowed hard conditions (all required):**

1. Change is on the **watch list**
2. `openspec-ops where <change> --json` succeeds (worktree exists)
3. Worktree **`dirty === false`**
4. Change is **not active** — v1 primary signal: **`changeDirExists === false`**  
   (OpenSpec change directory no longer present at the expected active path; typical after archive move)

Only then apply policy (`ask` confirm / `on` immediate finish).

**While change still active** (`changeDirExists === true`): do **not** finish; **keep watch**.

**Rationale:** Matches multi-turn archive; user language still “after archive”; implementation observes archive *result*.

**Alternative rejected:** one-shot finish on first `agent_settled` after `/opsx-archive` → early fire or dropped pending.

### D2. Split intent arm vs check vs act

```text
input: /opsx-archive <kebab>
  policy off? → no-op, continue
  strong signal + valid name? → watch.add(change)
  optional: where precheck not_found → do not watch (nothing to reclaim)
  always continue original input (never handled for archive)

agent_settled:
  if watch empty → return
  for each watched change (v1: typically one):
    evaluate orphan gate
```

`agent_settled` = **check point / poll**, not “archive done” event.

### D3. Watch lifecycle (sticky)

| Event | Watch action |
|---|---|
| Arm from archive slash with name | add |
| Settle + still active | keep |
| Settle + where not_found | remove (already gone) |
| Settle + orphan + clean + ask + user declines | remove (user refused cleanup) |
| Settle + orphan + clean + finish success | remove |
| Settle + orphan + dirty | notify skip; remove or keep once—**v1: remove after notify** to avoid nag loops; user uses `/ops-finish` |
| Settle + where/bin error | notify; **keep** watch once more optional—**v1: keep watch**, notify at most with throttle if easy; else notify every settle is OK for v1 |
| Policy off mid-session | no new arms; existing watches: **v1 clear all on off at arm time only** (settle no-ops if policy off) |

### D4. Policy default `ask`; `on` required

```text
OPENSPEC_OPS_AUTO_FINISH=ask|on|off
default: ask
```

| Value | When hard conditions hold |
|---|---|
| `ask` | `ui.confirm` → finish if accepted; if `!hasUI`, do **not** silent-finish (skip + notify) |
| `on` | `finish --json` without confirm |
| `off` | no arm; settle does not finish |

Asymmetry with auto-ensure default `on` is intentional (constructive vs reclaim).

CLI does not read this env.

### D5. How to detect “not active”

**v1 normative:** use `where` result field **`changeDirExists === false`** together with where success.

Optional non-normative strengtheners (not required for v1 pass): presence under `openspec/changes/archive/*-<change>`, or `openspec list` without the name—only if cheap and tested.

Do **not** require merge/PR state.

### D6. Dirty and force

- Automatic path MUST NOT pass `--force`
- Dirty orphan: notify that automatic cleanup skipped; manual `/ops-finish` + explicit force consent
- Clean-only for both `ask` and `on`

### D7. Sync harness step, not skill turn

At settle when acting:

- confirm (if ask) + `openspec-ops finish --json` + notify  
- Do **not** require loading `ops-finish` skill  
- Optional display-only message for transcript; no mandatory extra LLM turn

### D8. Fail-open for archive

- Never `handled` archive input due to finish-gate concerns
- Missing bin at arm: still allow archive; skip watch or watch and fail later at settle with notify
- Missing bin at settle: notify, do not claim archive failed
- Finish non-zero: report `error.code`; archive outcome independent

### D9. Layout

```text
.pi/extensions/openspec-ops-auto-ensure.ts   # wire watch + settle (rename later optional)
src/auto-finish/
  parse.ts       # isArchiveIntent, parseArchiveChangeName
  policy.ts      # parseAutoFinishPolicy → ask|on|off
  watch.ts       # in-memory watch set helpers if useful
  orphan-gate.ts # pure decision: where JSON + policy → skip|confirm|finish
```

Reuse `resolveOpsBin` / runOps from auto-ensure. Unit-test pure parse/policy/orphan decisions without full Pi.

### D10. Skill boundary

- Automation never depends on ops-finish skill expansion
- README: extension gate = Pi primary; `/ops-finish` = manual / other harnesses

### D11. Naming

Capability id remains `pi-auto-finish-on-archive` (user-facing “after archive”).  
Implementation docs MUST say **orphan reclamation / inactive change**, not “finish on archive command.”

## Risks / Trade-offs

- **[Risk] changeDirExists false for non-archive reasons** → default `ask`; `on` is opt-in aggressive; clean-only  
- **[Risk] Multi-turn archive early settled** → still active → no finish; sticky watch  
- **[Risk] Watch never clears if user abandons** → dirty/decline/not_found clear paths; session-scoped memory OK for v1  
- **[Risk] Slash-only arm misses skill/CLI archive** → documented v1 limit; phase 2 broader orphan scan  
- **[Risk] `on` surprises** → document; hard conditions reduce blast radius  
- **[Trade-off] No name on `/opsx-archive` → no watch** → same as ensure strictness  
- **[Trade-off] In-memory watch only** → lost on restart; user can `/ops-finish`  

## Migration Plan

1. Helpers + unit tests (parse, policy, orphan decision table)  
2. Extension: arm on archive input; evaluate on settle  
3. README policy + orphan semantics + skill fallback  
4. Smoke: multi-turn still-active no finish; after inactive + clean ask/on; dirty skip; off  
5. Rollback: `OPENSPEC_OPS_AUTO_FINISH=off`  

## Open Questions

- Phase 2: arm watches from ensure `active` workspace or doctor orphans without archive slash  

## Spike notes

- `input` only arms watch; never finish  
- `agent_settled` re-evaluates sticky watches  
- Finish only via `openspec-ops finish --json`  
- ensure fails closed for propose; this gate fails open for archive  

### Spike 1.1 (Pi agent_settled + UI)

Installed `@earendil-works/pi-coding-agent` exposes:

- `pi.on("agent_settled", handler)` with `ExtensionContext`
- `ctx.hasUI: boolean` and `ctx.ui.confirm(...)` on that context

**Conclusion:** settle-time confirm + CLI is supported. Under policy `ask` when `!hasUI`, pure gate returns `ask_no_ui` → skip finish (no silent reclaim). Documented in README and implemented in extension.  
