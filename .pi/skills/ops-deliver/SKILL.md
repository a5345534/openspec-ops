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

## Response language

Follow the injected `REQUIRED RESPONSE LANGUAGE` for all progress, findings, verdicts, hard stops, and summaries. English examples are structural templates: translate their natural-language meaning while preserving commands, paths, identifiers, error codes, JSON keys, URLs, and metrics markers exactly.

**Batch happy path** after **explore is finished**.  
One command: **start → finish** for a named change.

**Not** `/opsx-explore`. **Not** background auto-*.  
**`/ops-next`** remains for single-step manual control.

## Bound runtime (all CLI-backed stages)

When the extension follow-up contains `REQUIRED: openspec-ops binary is "..." (source=...)`, verify that exact path is still executable and use it for start/where/ship/merge/finish and every other openspec-ops CLI action in this pipeline. Treat it as one safely quoted command path; the extension also exports the same path as `OPENSPEC_OPS_BIN`. Never substitute raw Git, `npx`, or an unrelated PATH binary. If it becomes unusable, hard-stop clearly.

If no extension binding is present (for example direct skill use without the guided extension), fall back to a valid `OPENSPEC_OPS_BIN`, then `openspec-ops` on PATH, or stop with install/package guidance.

## Consent

Running `/ops-deliver <change>` means the operator authorizes, when gates pass:

- worktree start, propose/apply agent work, ship commits+PR  
- **squash merge** (no second `/ops-merge` confirm)  
- archive + finish (never `--force` unless user later asks outside deliver)

## Input

- **Required:** kebab-case change name  
- Optional: short objective text to seed propose  

Slash **`/ops-deliver`** is registered **only** on the guided extension (no `.pi/prompts/ops-deliver.md` — avoids dual slash registration). Args are parsed and a follow-up **binds** both the change name and validated CLI runtime so the agent must not claim either is missing.

This skill is agent-loaded (or `/skill:ops-deliver`); the slash entrypoint is the extension command.

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

## Optional local metrics markers

Before executing **each** pipeline action, emit this hidden Markdown comment on its own line (replace values; exact compact JSON):

```text
<!-- ops-metrics:stage {"change":"<change>","action":"<action-id>"} -->
```

Use action ids from the table (`ops-start`, `opsx-propose`, `ops-spec-review`, `opsx-apply`, `ops-ship`, `ops-impl-review`, `ops-merge`, `opsx-archive`, `ops-finish`). Review skills add the round and result markers. These comments are metadata-only and harmless when metrics are disabled. Never call a telemetry tool/model and never place finding text, source, tool output, or errors inside a marker.

## Steps (agent)

1. Resolve change name (see order above). If the message already binds a kebab name, **use it** — never stop with “name missing” when that binding is present.  
2. Loop (max **20** transitions per invocation):  
   a. Build signals: `where`, roots, `resolvePrSignals` (open/merged PR).  
   b. `station = detectLifecycleStation(...)`.  
   c. If `done` → report success; stop.  
   d. `action = defaultDeliverAction(station)`; if null → stop with guidance.  
   e. Emit the exact hidden `ops-metrics:stage` comment for `change` + `action`.
   f. **Execute action** via existing skills/CLI (`--json` for CLI):
      - **spec-review / impl-review:** run full skill (full-review rounds).  
        - If **needs human** → **STOP** deliver (do not merge).  
        - If **ready** → immediately run `deliverActionAfterReview` (apply or merge), then continue loop.  
      - **merge:** `openspec-ops merge <change> --json` (consent already given).  
        - `already_merged` → OK, continue.  
        - `checks_failed` / other errors → **STOP**.  
      - **finish:** never pass `--force`. Dirty → **STOP**.  
        Read the injected effective `finish.return-to-main` policy.
        - `required`: pass the single strict `--return-to-main` flag and hard-stop on `return_to_main_needs_human`, reporting its structured primary/submodule diagnostics.
        - `primary-only`: pass `--sync-primary --sync-submodules` only (ff primary + recursive submodule pin update). Do **not** pass `--return-to-main` or `--attach-submodule-main` solely due to this policy. Detached submodule checkouts at parent gitlink are the expected sync state. Hard-stop on primary dirty/diverged/sync failures.
        - `off`: do **not** pass `--return-to-main`, `--sync-primary`, `--sync-submodules`, or `--attach-submodule-main` unless the operator explicitly opts in.
   g. Continue loop (resume-friendly).
3. On stop: print station, last action, how to `/ops-deliver` again or `/ops-next`.

## Lifecycle success vs return-to-main

Completing deliver through **finish** means the change worktree closeout path succeeded (and PR merge/archive as applicable). It does **not** mean the operator’s **primary** checkout already matches `origin/<base>` or that submodules are on branch `main`.

Primary lagging `origin/main` alone is **not** a failed deliver when sync was not requested. With effective `finish.return-to-main=required`, lifecycle success additionally requires strict primary/submodule closeout (including attach); `return_to_main_needs_human` is a hard stop, not completion. With `primary-only`, deliver requires primary ff sync and submodule pin update without branch attach. After success, operators (or opt-in finish flags) may:

```bash
cd <primary> && git switch main && git pull --ff-only origin main
git submodule update --init --recursive
# expect submodule detached @ gitlink unless --attach-submodule-main was used safely
```

Or: `openspec-ops finish <change> --sync-primary [--sync-submodules] [--attach-submodule-main]` (default off).

## Mandatory reviews

- **No skip flags** in v1.  
- Never ship→merge without impl-review ready in this run (unless station already past merge).  
- Never apply without spec-review ready when still in propose/review path.

## Guardrails

- Do not run explore inside deliver.  
- Do not auto `--force` finish.  
- Do not enable primary sync flags on finish unless the operator explicitly opts in or effective policy requires them: `required` → `--return-to-main` only; `primary-only` → `--sync-primary --sync-submodules` only; `off` → none.
- Do not bypass merge checks.  
- Do not remove `/ops-next`.  
- Prefer worktree path from `where` for all OpenSpec writes after start.
