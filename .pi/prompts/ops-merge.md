---
name: ops-merge
description: Merge change PR via openspec-ops merge (squash default; checks hard gate). Only when user asks.
---

# /ops-merge

If current agent context contains the extension-bound `REQUIRED: openspec-ops binary is "..." (source=...)`, verify and use that exact safely quoted executable path first; the extension also exports it as `OPENSPEC_OPS_BIN`. Never concatenate the path into `sh -c`. Otherwise resolve `OPENSPEC_OPS_BIN`, then PATH, or stop clearly.

```bash
openspec-ops merge "<change>" [--method squash|merge|rebase] --json
```

- **Only if user asked to merge.** Invoke = consent.
- Checks must be green (hard block). Default **squash**.
- No archive/finish/prune/delete-branch.
- Next: archive → finish → prune (manual).
