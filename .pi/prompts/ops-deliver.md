---
name: ops-deliver
description: Start-to-finish lifecycle after explore; mandatory reviews; merge on invoke.
---

# /ops-deliver

After **explore is done**, run a change from **start through finish**.

**Slash args:** the guided extension registers `ops-deliver` and binds the kebab change name into a follow-up before the skill runs.

```text
start → propose → spec-review* → apply → ship → impl-review* → merge → archive → finish
```

\* **Required.** needs-human → stop.  
**Invoke = consent to squash-merge** when gates pass (no second merge confirm).  
**Resume** from current station on re-run.  
Never `--force` finish. Never skip reviews. Not explore.

## Steps

1. Require kebab change name.  
2. Loop (max 20): detect station (where + PR signals) → `defaultDeliverAction` → run skill/CLI.  
3. After successful spec-review → apply; after successful impl-review → merge.  
4. On failure/needs-human: stop; suggest re-run `/ops-deliver` or `/ops-next`.

See skill `ops-deliver` and `src/next-step/deliver.ts`.
