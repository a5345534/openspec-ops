---
name: ops-merge
description: >
  Merge the GitHub PR for an OpenSpec change via openspec-ops merge (gh).
  Use only when the user explicitly asks to merge. Default squash; checks must
  be green. Does not archive, finish, or prune.
license: MIT
compatibility: openspec-ops CLI + GitHub CLI gh
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-merge

Merge the **open PR** for a change branch into the base (default **squash**).

**Invoking this skill / CLI is consent** — no second “are you sure?”.  
**Only run when the user explicitly asked to merge** this turn.  
Do **not** call after ship or impl-review unless they asked to merge.

## Binary

1. `$OPENSPEC_OPS_BIN` or `openspec-ops` on PATH  
2. Always:

```bash
openspec-ops merge "<change>" [--method squash|merge|rebase] --json
```

Require `schemaVersion === 1`.

## Steps

1. Confirm user asked to **merge** (not only ship/review).
2. Run merge with `--json` (default method squash).
3. On `checks_failed`: report; do not bypass; wait for CI green and re-run.
4. On `pr_not_found`: ship first or fix branch name.
5. On success / `already_merged`: report PR; **next** (do not auto-run): `/opsx-archive` → finish → prune.

## Guardrails

- No force; no admin skip checks in v1.
- Do not delete branch (use prune later).
- Do not archive/finish as part of merge.
- Ship and ops-impl-review must not merge; this is the only ops merge entrypoint.
