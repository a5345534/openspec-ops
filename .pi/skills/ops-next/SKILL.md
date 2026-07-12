---
name: ops-next
description: >
  Guided next lifecycle step for an OpenSpec change: detect station, show
  hard-coded options via UI select or text menu, run only the operator's choice.
  Use after any lifecycle step completes, or when user says "what's next".
  Does not auto-continue. Not merge/ship by itself unless chosen.
license: MIT
compatibility: openspec-ops where; Pi ctx.ui.select when available
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-next

After a lifecycle step finishes, **ask what to do next**. Never auto-start the next skill.

## Steps

1. Require kebab change name.
2. Prefer `/ops-next <change>` Pi command if extension loaded (UI select).
3. Else compute station (where + proposal/tasks + optional gh PR state) using `src/next-step` rules:
   - applied → ship | stop (no spec-review)
   - shipped → impl-review | ship | merge | stop
   - etc. (hard-coded edges)
4. If UI: select. If not: print numbered text menu; **stop** and wait for user slash.
5. Only run the chosen slash (or tell user to run it). Cancel/stop → do nothing.

## Guardrails

- No auto-ensure, auto-review, auto-finish, auto-impl-review.
- Do not default to first option on cancel.
- In-step multi-round inside spec-review/impl-review is OK once that skill is chosen.
