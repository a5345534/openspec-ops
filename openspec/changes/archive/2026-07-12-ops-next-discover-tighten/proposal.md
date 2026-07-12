# Change: ops-next-discover-tighten

## Why

Nameless `/ops-next` candidate discovery is too broad. It treats `basename(root)` as a change name when it matches kebab-case, so package/clone directories like **`openspec-ops`** always appear in the pick list. Operators also see stale active `openspec/changes/<name>/` entries that should already be archived. False candidates make guided next-step unusable.

## What Changes

- Tighten `listCandidateChanges`:
  - **Remove** (or strictly gate) adding `basename(root)` as a candidate when `root` is a package root / primary checkout / known non-worktree path
  - Prefer only:
    1. Active `openspec/changes/<kebab>/` (not under `archive/`)
    2. Directories under `<primary>/.worktrees/<kebab>/` that look like change worktrees (optional: require git worktree registration if cheap)
  - Never treat the package name `openspec-ops` (or basename of `PACKAGE_ROOT`) as a change solely because it is the install root
- Update unit tests: package-root basename must not appear; active change dir and `.worktrees/<change>` still do
- Document discovery rules in guided-next-step / ops-next skill
- Optional hygiene note: doctor or docs when active change dir exists alongside archive for same name (out of scope to auto-delete)

## Capabilities

### Modified Capabilities

- `guided-next-step`: candidate discovery MUST NOT include package/repo root basename as a change; MUST still find worktree leaves and active change dirs
- `pi-ops-skills`: ops-next skill documents tightened discovery sources

## Impact

- `src/next-step/discover-changes.ts` + tests + skill one-liner
- Fixes false `openspec-ops` pick option when using Pi-installed package path

## Non-goals

- Auto-removing stale active change directories
- Full `git worktree list` dependency if FS heuristics suffice
- Renaming the package
