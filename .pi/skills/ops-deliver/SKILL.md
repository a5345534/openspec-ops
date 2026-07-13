---
name: ops-deliver
description: >
  After explore is done: run change from ops-start through ops-finish (propose,
  mandatory spec-review + impl-review, ship, merge, archive, finish). Invoke =
  consent to squash-merge when gates pass. Resume from current station. Use
  /ops-deliver. Does not explore; does not skip reviews; never force-finish.
license: MIT
compatibility: openspec-ops CLI + existing ops/opsx skills; gh for ship/merge
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-deliver

**Batch happy path** after **explore is finished**.  
One command: **start → finish** for a named change.

**Not** `/opsx-explore`. **Not** background auto-*.  
**`/ops-next`** remains for single-step manual control.

## Consent

Running `/ops-deliver <change>` means the operator authorizes, when gates pass:

- worktree start, propose/apply agent work, ship commits+PR  
- **squash merge** (no second `/ops-merge` confirm)  
- archive + finish (never `--force` unless user later asks outside deliver)

## Input

- **Required:** kebab-case change name  
- Optional: short objective text to seed propose  

Slash **`/ops-deliver`** is registered on the guided extension: args are parsed and a follow-up message **binds** the change name so the agent must not claim it is missing.

```text
/ops-deliver my-change
/ops-deliver my-change "add dark mode toggle"
```

### Resolving the change name (order)

1. Extension-bound line: `change name is \`<name>\`` or `REQUIRED: change name is \`<name>\``  
2. Explicit `change=<name>` in the message  
3. First kebab token after `/ops-deliver` / `ops-deliver`  
4. If still missing → stop and ask (do **not** invent a name)

## Pipeline (default order)

```text
start → propose → spec-review → apply → ship → impl-review → merge → archive → finish
```

| Station (detect) | Deliver default |
|---|---|
| no_workspace | `/ops-start` |
| ready_to_propose | `/opsx-propose` |
| proposed | **`/ops-spec-review` (required)** → if ready → `/opsx-apply` |
| applied | `/ops-ship` |
| shipped | **`/ops-impl-review` (required)** → if ready → `/ops-merge` |
| merged | `/opsx-archive` |
| archived | `/ops-finish` (no `--force`) |
| done | stop success |
| unknown | stop + suggest doctor / `/ops-next` |

Code table: `defaultDeliverAction` / `deliverActionAfterReview` in `src/next-step/deliver.ts`.

## Steps (agent)

1. Resolve change name (see order above). If the message already binds a kebab name, **use it** — never stop with “name missing” when that binding is present.  
2. Loop (max **20** transitions per invocation):  
   a. Build signals: `where`, roots, `resolvePrSignals` (open/merged PR).  
   b. `station = detectLifecycleStation(...)`.  
   c. If `done` → report success; stop.  
   d. `action = defaultDeliverAction(station)`; if null → stop with guidance.  
   e. **Execute action** via existing skills/CLI (`--json` for CLI):  
      - **spec-review / impl-review:** run full skill (full-review rounds).  
        - If **needs human** → **STOP** deliver (do not merge).  
        - If **ready** → immediately run `deliverActionAfterReview` (apply or merge), then continue loop.  
      - **merge:** `openspec-ops merge <change> --json` (consent already given).  
        - `already_merged` → OK, continue.  
        - `checks_failed` / other errors → **STOP**.  
      - **finish:** never pass `--force`. Dirty → **STOP**.  
   f. Continue loop (resume-friendly).  
3. On stop: print station, last action, how to `/ops-deliver` again or `/ops-next`.

## Mandatory reviews

- **No skip flags** in v1.  
- Never ship→merge without impl-review ready in this run (unless station already past merge).  
- Never apply without spec-review ready when still in propose/review path.

## Guardrails

- Do not run explore inside deliver.  
- Do not auto `--force` finish.  
- Do not bypass merge checks.  
- Do not remove `/ops-next`.  
- Prefer worktree path from `where` for all OpenSpec writes after start.
