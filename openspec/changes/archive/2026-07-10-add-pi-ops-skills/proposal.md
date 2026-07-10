## Why

Phase 0 delivered the `openspec-ops` CLI for change worktree lifecycle, but Pi agents still have no first-class way to invoke it safely. Without skills/prompts, agents either skip workspace setup or reimplement `git worktree` ad hoc—breaking the “CLI is the only side-effect surface” rule and the official OpenSpec loop boundary.

## What Changes

- Add four Pi skills under `.pi/skills/`: `ops-start`, `ops-where`, `ops-finish`, `ops-doctor`
- Add four matching slash prompts under `.pi/prompts/`: `ops-start.md`, `ops-where.md`, `ops-finish.md`, `ops-doctor.md`
- Each skill and each prompt is **full-text self-contained** (shared runtime rules embedded; no “see other file” runtime dependency)
- Document that skills only shell out to `openspec-ops … --json` and never replace `/opsx-*` OpenSpec commands
- Update root README with how to use `/ops-start` … `/ops-finish` alongside OpenSpec

## Capabilities

### New Capabilities
- `pi-ops-skills`: Pi agent skills and slash prompts that orchestrate the openspec-ops workspace CLI (start/where/finish/doctor) with stable JSON handling, confirmations, and OpenSpec boundary guardrails

### Modified Capabilities
- _(none — `workspace-lifecycle` CLI requirements stay as-is; this change only adds harness-facing instructions)_

## Impact

- **New files**: `.pi/skills/ops-*/SKILL.md`, `.pi/prompts/ops-*.md`
- **Docs**: README usage for Pi
- **No CLI code changes** required unless copy reveals a doc bug
- **Consumers**: Pi sessions in this repo (project skills); optional later copy/symlink to `~/.pi/agent/skills`
- **Risk**: dual maintenance of skill vs prompt text—mitigated by explicit sync requirement in specs/tasks
