---
name: ops-next
description: >
  Guided next lifecycle step for an OpenSpec change: detect station, show
  hard-coded options via UI select or text menu, run only the operator's choice.
  Change name optional — omit to pick among candidates. Use after any lifecycle
  step, or when user says "what's next". Does not auto-continue.
license: MIT
compatibility: openspec-ops where; Pi ctx.ui.select when available
metadata:
  author: openspec-ops
  version: "0.2.0"
---

# ops-next

After a lifecycle step finishes, **ask what to do next**. Never auto-start the next skill.

## Input

- **Optional:** kebab change name  
  - `/ops-next my-change` — skip pick; go to station menu  
  - `/ops-next` — discover candidates (worktrees + active `openspec/changes/*`)  
    - 0 → notify  
    - 1 → use it  
    - N → `ui.select` pick change (headless: print list, re-run with name)

## Steps

1. Resolve change (arg or pick as above).
2. Prefer Pi `/ops-next` command if extension loaded.
3. Compute station (where + proposal/tasks + optional PR signals).
4. Show next-action menu (`ui.select` or text). Cancel/stop → do nothing.
5. Only run the chosen slash.

## Guardrails

- No auto-ensure, auto-review, auto-finish, auto-impl-review.
- Do not default to first option/change on cancel (except single-candidate change).
- In-step multi-round inside spec-review/impl-review is OK once chosen.
