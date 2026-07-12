# Change: package-and-docs-hygiene

## Why

Post-guided-lifecycle audit found packaging and docs lagging the product:

1. **`package.json` `files` omits `ops-next`** (and possibly its prompt)—consumers of the pi-package may not get the guided next-step skill.
2. **`dist/` retains compiled `auto-*` modules** deleted from `src/`—stale publish surface if `dist` is shipped.
3. **`.pi/prompts/ops-finish.md`** still implies finish always keeps the branch (`branchDeleted: false`), contradicting finish-absorbs-prune behavior.
4. **`worktree-loop-closure` main specs** still describe auto-finish scenarios though auto-finish is retired.
5. **README intercept** and **vendor** snippets still lean on auto-ensure wording.

## What Changes

- Add `.pi/skills/ops-next` (and prompt if present) to `package.json` `files`; ensure package-export tests assert ops-next is published and dist has no `auto-*`
- Clean build: remove stale `dist/auto-*` (and prevent reintroduction via clean script or prebuild)
- Fix ops-finish prompt (and skill if needed) for merged-branch cleanup / result actions
- Scrub or MODIFIED `worktree-loop-closure` auto-finish scenarios to match retired auto + guided finish
- Soften intercept README to forward-only; vendor alignment lines without promoting auto-ensure
- Optional: lifecycle skills end with “offer `/ops-next`” one-liner (if in scope)

## Capabilities

### Modified Capabilities

- `pi-package-ops-surface` / package export expectations: publish ops-next; no dead auto dist modules
- `pi-ops-skills`: finish prompt/skill accuracy; ops-next packaged
- `worktree-loop-closure`: remove or rewrite live auto-finish requirements/scenarios
- `finish-closeout` or finish skill docs if needed for prompt alignment

## Impact

- package.json, build hygiene, prompts, specs, tests
- No intentional behavior change to CLI commands beyond docs accuracy

## Non-goals

- Removing prune CLI
- Deleting intercept binary entirely
- Collapsing all pi-auto-* stubs (unless trivial)
