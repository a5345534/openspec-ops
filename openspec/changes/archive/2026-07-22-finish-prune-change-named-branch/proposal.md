## Why

After a successful deliver (ship → merge → archive → finish), leftover **local and remote feature branches** can remain when the worktree’s current branch at finish time differs from the change-named branch (for example after an agent switches the worktree to `archive-<change>` for a follow-up archive PR). Finish correctly prunes only the single resolved head, so operators still see residual `<change>` branches even though the feature PR is squash-merged and the worktree is gone. This is branch hygiene / DX (issue #46), not merge correctness.

## What Changes

- Expand `openspec-ops finish` merged-branch cleanup so it attempts safe prune of **both**:
  - the **change-default** branch (`defaultBranch(change, --branch)`, normally `<change>` when `--branch` is omitted)
  - the **resolved located** branch (worktree current branch when present; otherwise same as change-default) when different
- Each candidate head is gated **independently** by merged-PR lookup; unmerged heads are kept
- Keep non-force local delete (`git branch -d`) and remote delete; never `-D` / force-push
- Extend finish JSON/human reporting so multi-head cleanup outcomes are visible (not a single opaque summary that hides a leftover change-named branch)
- Document and skill-guide archive/deliver path: prefer archiving on the original change branch; if a different head is used, finish still cleans change-named when its PR is merged
- **Out of scope:** submodule remote/local feature-branch deletion (remains diagnostics-only / #30 Phase B), squash merge semantics, treating leftover branches as merge failure

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `finish-closeout`: Multi-head parent branch cleanup — always consider change-default branch in addition to located/resolved branch when pruning after merged PR verification
- `pi-ops-skills`: ops-finish / ops-deliver guidance for multi-head cleanup and archive-on-change-branch preference
- `ops-deliver`: Closeout expectation that finish leaves change-named parent branches cleaned when their PRs are merged (worktree gone does not imply inventory clean unless finish multi-head path ran)

## Impact

- Code: `src/commands/finish.ts`, possibly `src/commands/branch-cleanup.ts`, `src/types.ts` (`FinishResult.branchCleanup` shape), tests under `tests/finish-closeout.test.ts` (and related)
- Docs: README finish/closeout notes; `.pi/skills/ops-finish`, `.pi/skills/ops-deliver` (and prompts if present)
- CLI contract: success still never force-deletes unmerged branches; JSON may gain structured multi-branch cleanup fields (backward-compatible aggregation retained where possible)
- Related but not implemented: issue #30 submodule prune Phase B
