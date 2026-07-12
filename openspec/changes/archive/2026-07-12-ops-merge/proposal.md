## Why

The delivery loop automates ship and post-ship impl-review, but **merge into the base branch** is still a bare human GitHub click or ad-hoc `gh pr merge`. Operators want a single **explicit** command—CLI and Pi skill—that merges the change’s PR with clear safety rules: **invoking the command is consent** (no second confirm), **CI checks must pass** (hard gate), default **squash**, and **no** chaining into archive/finish/prune. Ship and impl-review remain non-merging.

## What Changes

- Add CLI **`openspec-ops merge <change>`**:
  - Resolve change branch (default = change name) and open PR via `gh`
  - **Hard-block** if PR checks are not all successful
  - Merge with default method **squash** (`--method squash|merge|rebase` override)
  - **No** second interactive confirmation; running the command is authorization
  - **No** `--delete-branch` by default (prune remains separate)
  - **No** auto-merge policy; **no** post-merge archive/finish/prune chain
  - JSON result: PR identity, method, merged state; idempotent already-merged handling
- Add Pi skill/prompt **`ops-merge`** / `/ops-merge`: only when the user asked to merge; must not be called after ship/impl-review without an explicit merge request
- README loop: … → ops-impl-review → **ops-merge** → archive → finish → prune
- Keep ship / impl-review specs: they still MUST NOT merge

## Capabilities

### New Capabilities
- `ops-merge`: Explicit PR merge for a named change (gh), checks-gated, default squash, invoke-is-consent.

### Modified Capabilities
- `workspace-lifecycle`: Add `merge` command to CLI surface and help.
- `pi-ops-skills`: Ship ops-merge skill/prompt; reinforce ship/impl-review do not merge.
- `worktree-loop-closure`: Document merge step between impl-review and archive.
- `ops-ship` / `ops-impl-review`: restate they MUST NOT merge; unique merge entrypoint is ops-merge.

## Impact

- New `src/commands/merge.ts`, gh checks/merge helpers, types/CLI, skill/prompt, README, tests
- Workflow: agent can complete merge when user runs `/ops-merge` or CLI
- Risk: mis-invocation merges without extra prompt—mitigated by skill “only when user requested merge” and checks hard gate
- Non-impact: no auto-merge-on-green bot; no archive/finish/prune automation in this command
