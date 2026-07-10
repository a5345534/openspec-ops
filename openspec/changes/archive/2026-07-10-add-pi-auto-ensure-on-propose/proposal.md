## Why

Users should not have to remember `/ops-start` before OpenSpec planning. The Phase 0 CLI and `ops-*` skills already define workspace ensure, but daily flow still depends on a manual extra step. A Pi harness hook can silently ensure the worktree when it detects `/opsx-propose`, then let the original OpenSpec propose path run unchanged.

## What Changes

- Add a project-local Pi **extension** that intercepts propose-intent input (strong signals such as `/opsx-propose`)
- On intercept with a parseable change name and policy enabled: run `openspec-ops` ensure (`where` then `start` if needed) via `--json`, then **release** the original input so the stock `/opsx-propose` prompt/skill flow proceeds
- Default policy **`on`** (silent ensure); support `off` and optional `ask` via env/config without changing OpenSpec
- On ensure failure (conflicts/environment): **do not** continue propose; surface CLI `error.code`
- Keep explicit `/ops-start` (and related ops commands if registered) as advanced/manual entry points
- Do **not** rewrite OpenSpec propose steps, prompts, or CLI semantics
- Document behavior, policy, and disable switch in README

## Capabilities

### New Capabilities
- `pi-auto-ensure-on-propose`: Pi harness gate that ensures an openspec-ops workspace before OpenSpec propose, without modifying OpenSpec’s propose workflow

### Modified Capabilities
- _(none required for CLI `workspace-lifecycle` behavior; optional later doc cross-links only)_

## Impact

- **New code**: `.pi/extensions/` TypeScript extension (and small shared helpers if needed)
- **Depends on**: `openspec-ops` CLI (`schemaVersion: 1`), existing bin resolution rules
- **Does not change**: `openspec` CLI, `/opsx-propose` artifact content rules, archive/apply semantics
- **UX**: default silent worktree ensure on propose; `OPENSPEC_OPS_AUTO_START=off` restores native behavior
- **Risk**: wrong cwd after ensure if agent still writes on primary—mitigate with notify + optional context inject, not by forking propose
