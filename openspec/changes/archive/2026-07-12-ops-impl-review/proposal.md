## Why

`ops-spec-review` cleans the **plan** before apply; after apply and **ship** (commit + PR), there is no symmetric gate that checks whether **implementation** matches specs/tasks, runs tests, and fixes gaps before human merge. Operators want an **ops-impl-review** skill—same iterative review→fix→re-review pattern—run **after ship**, with optional **auto follow-up** (default **on**) that may edit code, re-test, and **push** to the PR branch.

## What Changes

- Add **`ops-impl-review`** skill + `/ops-impl-review` prompt:
  - Timing: **after ship**, before merge (primary)
  - Inputs: change worktree, specs + tasks, PR/`git` diff vs base, **test run** (failure = major)
  - Loop: review → **edit implementation** (and honest task checkboxes if needed) → **push** to existing PR branch → re-review
  - Stop when no **major** findings or **max rounds** hit (default 3)
  - Not GitHub approve/merge; not a substitute for human CODEOWNERS
- Extend **ops-config** / session store:
  - Key `impl-review.max-rounds` (default 3; env `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS`)
  - Precedence: session > env > default (same as spec-review)
- **Auto after ship** (default **on**):
  - Policy env `OPENSPEC_OPS_AUTO_IMPL_REVIEW=on|off` (default **on**)
  - After successful ship in Pi (or documented hook point), schedule follow-up `/ops-impl-review <change>`
  - Document cost/risk: may edit code and push
- README loop: apply → ship → ops-impl-review → merge → …

## Capabilities

### New Capabilities
- `ops-impl-review`: Iterative implementation quality gate after ship (spec/task alignment, tests, fix+push loop).
- `pi-auto-impl-review-follow-up`: Auto-schedule ops-impl-review after successful ship when policy on.

### Modified Capabilities
- `ops-config`: Support `impl-review.max-rounds` (and document env).
- `pi-ops-skills`: Ship ops-impl-review skill/prompt; ops-ship skill instructs post-success impl-review when auto on.
- `worktree-loop-closure`: Document impl-review between ship and merge.

Note: Auto handoff is **skill-contract** on ops-ship (not a separate ops-ship delta capability).

## Impact

- New skill/prompt; pi-config keys; ops-ship skill handoff after success; README
- Workflow: higher confidence before merge; longer ship tail when auto on
- Non-impact: no multi-model; no auto-merge/approve; finish/prune/archive unchanged; does not replace ops-spec-review
