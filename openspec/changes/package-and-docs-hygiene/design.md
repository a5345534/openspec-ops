# Design: package-and-docs-hygiene

## package.json files

Add at least:

```text
.pi/skills/ops-next
.pi/prompts/ops-next.md   # if file exists; else skip
```

Verify list includes: ops-merge, ops-ship, ops-impl-review, ops-spec-review, ops-start, ops-where, ops-finish, ops-doctor, ops-next, extension dir.

## dist clean

- `rimraf dist` before `tsc` (npm script `"prebuild": "rm -rf dist"` or `"build": "rm -rf dist && tsc..."`)
- Confirm after build: no `dist/auto-ensure|auto-review|auto-finish|auto-impl-review`
- Test: package-export or a small test that `dist/auto-ensure` does not exist after build

## Finish prompt

Align with finish-closeout:

- Success may be `removed` | `removed_and_pruned` | …
- Branch kept when not merged or `--keep-branch`
- Branch may be deleted when PR merged

## worktree-loop-closure

Find requirements/scenarios mentioning auto-finish as live behavior; MODIFIED or REMOVED to:

- finish is operator-selected / guided next-step
- dirty finish still refuses without force (CLI truth, not auto-finish)

## Intercept / vendor

- README: intercept is optional forward-only; ensure-before-new-change removed
- vendor: “start does NOT chdir” without “auto-ensure” as active product name

## Skill endings (optional stretch)

If time: one line at end of ship/merge/archive-adjacent skills: “Offer `/ops-next <change>`.”
