---
name: ops-merge
description: Merge change PR via openspec-ops merge (squash default; checks hard gate). Only when user asks.
---

# /ops-merge

```bash
openspec-ops merge "<change>" [--method squash|merge|rebase] --json
```

- **Only if user asked to merge.** Invoke = consent.
- Checks must be green (hard block). Default **squash**.
- No archive/finish/prune/delete-branch.
- Next: archive → finish → prune (manual).
