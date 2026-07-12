## Why

`/ops-review` is easy to confuse with code/PR review, and it is a **one-shot** advisory pass: it does not drive a fix loop, so major plan issues often remain until apply. Operators want a clearly named **OpenSpec plan/spec quality gate** between propose and apply that **reviews, edits artifacts, and re-reviews** until there are no major findings (or a round cap). Configuration for that cap (and future Pi-facing ops knobs) should be set **inside Pi** via a slash command—not project config files.

## What Changes

- Replace the primary plan-review entrypoint with **`ops-spec-review`** (`/ops-spec-review`):
  - Single session / single model (no multi-model fan-out in this change)
  - Read proposal, design, specs, tasks (spec-first analysis)
  - **Directly edit** change artifacts to address **major** findings
  - Loop until major count is 0 or **max rounds** reached (default **3**, configurable)
  - Report rounds, fixes applied, residual minor findings, verdict
- Add Pi **`ops-config`** command (session-scoped store, **no project config file**):
  - `show` / `get` / `set` / `unset` / `reset`
  - At least `spec-review.max-rounds` (default 3)
  - Precedence: **session > env (optional fallback) > default**
  - Inject effective config into the agent context when relevant
- Point **auto-review follow-up** at `/ops-spec-review` instead of `/ops-review` (same **full** review-fix loop, not read-only)
- **Delete** legacy **`ops-review`** skill/prompt (no redirect stub)
- Support **`OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS`** env as fallback under session config
- Update README / loop docs: propose → ops-spec-review → apply; document auto-review cost (multi-round edits)

## Capabilities

### New Capabilities
- `ops-spec-review`: Iterative OpenSpec plan/spec review with in-session artifact fixes until no major findings (capped rounds).
- `ops-config`: Pi session configuration for openspec-ops (no project config files).

### Modified Capabilities
- `pi-auto-review-follow-up`: Follow-up slash entrypoint becomes `/ops-spec-review`; review body remains skill-driven (not a mechanical CLI).
- `pi-ops-skills`: Ship ops-spec-review + ops-config; **remove** ops-review skill/prompt.
- `worktree-loop-closure`: Document ops-spec-review between propose and apply.

## Impact

- Pi skills/prompts, auto-review constant/extension strings, optional small config module used by extension
- Agent workflow: plan quality loop before apply
- Non-impact: no multi-model parallel review; no hard apply CLI block; no `openspec-ops review` mechanical analyzer; no project-level config files; finish/ship/prune unchanged
