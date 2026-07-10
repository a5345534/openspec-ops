## Why

After an OpenSpec change is no longer active (typically after archive), its git worktree is often left behind—disk noise, branch still checked out, doctor clutter. Users must remember a separate `/ops-finish` step. Propose already has a Pi harness gate (auto-ensure); the right side of the loop needs matching **orphan worktree reclamation** via the CLI—driven by **change active-state**, not by guessing that an archive *command* has finished—without modifying OpenSpec archive and without relying on the agent to run the ops-finish skill.

## What Changes

- Add a Pi **extension gate** that can **watch** a change (v1: arm watch on strong `/opsx-archive <kebab-name>` signals) and, on later **check points** (`agent_settled` while watches exist), reclaim the worktree when it is an **orphan**
- **Orphan / finish-allowed hard conditions:** `openspec-ops where` finds the worktree, worktree is **clean**, and the OpenSpec change is **no longer active** (v1: `changeDirExists === false` from where, or equivalent “not in active changes”)
- While the change is still active, keep the watch and **do not** finish (supports multi-turn archive)
- Under default policy **`ask`**: confirm then `openspec-ops finish … --json`; under **`on`**: finish without confirm when hard conditions hold; **`off`**: no watch/finish side effects
- **Never** block or abort OpenSpec archive; missing binary / evaluation errors are fail-open for archive
- Dirty worktrees: never auto-finish, never `--force`; notify and point at manual `/ops-finish`
- Keep `ops-finish` skill/prompt as **manual / no-hook harness fallback** only—not the Pi automation main path
- Do **not** edit `.pi/prompts/opsx-archive.md` or OpenSpec archive semantics
- Document policy env (`OPENSPEC_OPS_AUTO_FINISH`), default `ask`, required `on`/`off`, watch vs orphan semantics, and skill fallback in README

## Capabilities

### New Capabilities
- `pi-auto-finish-on-archive`: Pi harness gate that watches for post-archive (or otherwise inactive) changes and reclaims orphan openspec-ops worktrees via CLI finish, without modifying OpenSpec archive

### Modified Capabilities
- _(none; `pi-ops-skills` finish skill remains manual-only)_

## Impact

- **Code**: extend `.pi/extensions/openspec-ops-auto-ensure.ts` (or sibling) + `src/auto-finish/` helpers (watch list, active/orphan evaluation, policy, settle checks); reuse bin/runOps patterns
- **Depends on**: `openspec-ops` where/finish JSON (`schemaVersion: 1`, including dirty / changeDirExists), Pi `input` + `agent_settled`, UI confirm when policy `ask`
- **Does not change**: OpenSpec archive steps, `opsx-archive` prompt body, branch deletion, commit/PR/merge
- **UX**: after change becomes inactive with a clean leftover worktree → confirm or auto-finish per policy; branch kept
- **Risk**: false orphan if change dir missing for non-archive reasons—mitigate with confirm default, clean-only, and clear watch rules; never silent force
