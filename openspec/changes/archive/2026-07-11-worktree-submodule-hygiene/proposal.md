## Why

Change worktrees put the **parent** repo on a named branch, but nested **git submodules** often remain on **detached HEAD** at the parent’s recorded SHA. Agents following worktree write alignment then implement inside the submodule without a branch—fragile history, hard to PR, and the parent cannot update a submodule pointer until the submodule has real commits. openspec-ops already aligns paths and blocks dirty finish; it does not yet make submodule git identity visible or documented.

## What Changes

- Document the **parent branch vs submodule branch** model for monorepos with submodules (README + worktree-alignment snippet; ops-start / apply-oriented notes).
- Extend **doctor** and **where** JSON to report **top-level** submodules under a change worktree that are **detached** (and elevate when also dirty)—without changing finish’s dirty semantics.
- **Finish** dirty refuse message **must** note possible submodule uncommitted work / force risk (no auto-commit, no auto branch create in v1).
- **No** automatic submodule branch creation, commit, push, or merge in this change (deferred as opt-in follow-up).
- **Out of doctor scope in v1:** submodule that is attached to a branch but dirty (parent `finish` dirty gate still applies).

## Capabilities

### New Capabilities
- `worktree-submodule-hygiene`: Observability and documentation for submodule detached/dirty state under openspec-ops change worktrees (one-level scan; no auto-commit).

### Modified Capabilities
- `workspace-lifecycle`: `where` result includes additive `submodules` summary; finish dirty message mentions submodule risk (not **BREAKING**; clients must tolerate older clients ignoring new fields).
- `pi-ops-skills`: ops-start (and apply-alignment notes) mention never leaving long-lived work on detached submodule HEAD.
- `worktree-write-alignment`: Docs/snippet state that path alignment does not create submodule feature branches.

## Impact

- Affected code: `src/git` or new submodule probe helper, `doctor`, optional `where` / types, finish human/error text, README, `docs/snippets/`, ops skill text if present.
- Affected workflows: monorepos with `.gitmodules` under change worktrees (e.g. AOS-shaped); repos without submodules MUST see zero noise.
- Non-impact: OpenSpec propose/apply/archive semantics; ship/merge automation; recursive nested submodules beyond top-level; replacing submodules with subtrees.
