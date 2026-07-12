# Change: merge-empty-checks-allow

## Why

`openspec-ops merge` treated **zero reported PR checks** as `checks_failed` (fail closed).
Repos without CI (common for this package) could never use ops-merge and had to fall back to raw `gh pr merge`.

## What Changes

- **Empty checks default to allow** — no configured CI means no check gate.
- Pending/failing checks still hard-block.
- Opt into old fail-closed empty policy via `OPENSPEC_OPS_MERGE_EMPTY_CHECKS=refuse` (aliases: `strict`, `fail`, `off`).
- Docs/skills note the empty-checks policy.

## Capabilities

### Modified Capabilities

- `ops-merge`: empty checks allow by default; refuse only when env requests fail-closed empty.

## Impact

- CLI: `assertPullRequestChecksGreen` in gh backend
- Env: `OPENSPEC_OPS_MERGE_EMPTY_CHECKS`
- README + ops-merge skill
