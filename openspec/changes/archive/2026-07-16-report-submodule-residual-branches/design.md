## Context

`start --init-submodule-branches` may create or switch a branch matching the parent change inside checked-out top-level submodules. `finish` later deinitializes and removes the parent change worktree, then independently prunes only the parent branch after parent PR merge verification. The finish result has no representation for submodule branch refs that remain.

Submodule repositories are independent. A parent PR merge does not prove a submodule branch is merged or safe to delete. Remote-tracking refs may also be stale. The reliable low-risk improvement is therefore observability, not automatic pruning.

## Goals / Non-Goals

**Goals:**

- Detect matching local and remote-tracking refs in checked-out top-level submodules.
- Capture diagnostics before teardown makes submodule paths unavailable.
- Return stable, machine-readable entries that cannot be confused with parent cleanup.
- Remain bounded, read-only, fail-open, and network-free.
- Keep an always-present empty array for parse stability.

**Non-Goals:**

- Delete local or remote submodule branches.
- Claim that a remote-tracking ref proves a live or merged remote branch.
- Fetch, call `gh`, infer submodule PR state, or recurse into nested submodules.
- Persist diagnostics after finish or discover historical branches without a checked-out submodule.

## Decisions

### Add a dedicated matching-branch probe

A new helper will inspect each checked-out top-level submodule declared by `.gitmodules`. For the expected branch name it will mechanically query:

- `refs/heads/<branch>` for a local branch;
- configured remote names and `refs/remotes/<remote>/<branch>` for remote-tracking refs;
- the current symbolic branch, where available.

Only existing matches produce entries. Individual submodule/Git failures are skipped so diagnostics cannot block finish.

### Use one entry per observed ref

`SubmoduleBranchDiagnostic` will contain:

- stable code `submodule_change_branch_local` or `submodule_change_branch_remote_tracking`;
- submodule `path`;
- matched `branch`;
- `remote` for remote-tracking entries, otherwise null;
- whether the local branch is currently checked out.

The explicit `remote_tracking` code prevents the report from overstating remote truth.

### Capture before prepare and return after closeout

`runFinish` will collect diagnostics for the resolved located/explicit parent branch immediately after locating the clean/authorized worktree and before `prepareWorktreeForRemoval`. It will include the captured array in the final result regardless of parent branch cleanup outcome. Branch-only finish and worktrees without observable matches return `[]`.

Diagnostics do not alter success, error, cleanup, or `forced` semantics.

### Limit Phase A to finish

Doctor sees active linked worktrees where a same-named submodule branch is often expected, not residual. Without a merged-parent signal or persisted closeout context it would produce noisy false positives. Phase A therefore reports at the reliable finish boundary; doctor integration can be added later if it gains a trustworthy closeout-state signal.

## Risks / Trade-offs

- [Remote-tracking refs may be stale] → Name them explicitly and document verification before manual deletion.
- [Deinitialized or absent submodule cannot be probed] → Return no entry; never infer from parent gitlinks.
- [Diagnostic collection fails] → Fail open with `[]`; lifecycle closeout remains unaffected.
- [Long-lived residuals are not discoverable after finish] → The finish JSON is the handoff point; persistence is out of scope.
