## Why

OpenSpec's recommended team loop maps each change to a branch (and optionally a worktree), but OpenSpec itself never touches git. That left-side workspace setup—and the later cleanup—is still manual, easy to skip, and inconsistent across projects. This change adds a harness-neutral CLI that automates only that git/worktree lifecycle so the official OpenSpec flow can stay unchanged.

## What Changes

- Add a Phase 0 CLI binary named `openspec-ops` with four commands: `start`, `where`, `finish`, `doctor`
- Bind each OpenSpec change name to a default branch and worktree path by convention (no sidecar state file)
- Make `start` idempotent; make `finish` remove the worktree while keeping the branch; make `doctor` read-only
- Support human-readable output and stable `--json` envelopes (`schemaVersion: 1`) for skills/agents
- Document the official everyday loop mapping (start → `/opsx:*` → finish) without wrapping or replacing OpenSpec commands

## Capabilities

### New Capabilities
- `workspace-lifecycle`: Git worktree/branch lifecycle for an OpenSpec change name—create/reuse workspace, locate it, remove it, and report health—without modifying OpenSpec semantics

### Modified Capabilities
- _(none — no existing specs in this repo)_

## Impact

- **New code**: CLI entrypoint and workspace operations under this repo (implementation language TBD in design)
- **Runtime dependency**: local `git` with worktree support
- **Non-impact**: OpenSpec CLI/skills/prompts remain untouched; no commit/PR/archive automation; no Orca requirement
- **Consumers**: humans in a terminal; later thin skills/Pi adapters shell out to this CLI
- **Dogfood note**: this repo may need its own git root before self-hosting the tool; verification can use fixtures and an external repo
