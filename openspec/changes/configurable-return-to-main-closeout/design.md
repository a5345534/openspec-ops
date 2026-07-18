## Context

`finish` already exposes independent `--sync-primary`, `--sync-submodules`, and `--attach-submodule-main` flags. They run after change worktree/branch closeout, but attachment assumes `main`, can use branch-resetting switch behavior, treats divergence as partial success, and returns only path lists. `/ops-deliver` deliberately passes none of them by default. Pi's existing session configuration supports typed review-round keys with session > env > default precedence and injects effective values before each agent turn.

## Goals / Non-Goals

**Goals:**

- Let operators opt into a reusable `required` return-to-main policy while retaining `off` by default.
- Give deliver one unambiguous strict finish invocation.
- Synchronize only clean primary/submodule state using fetch/switch/ff-only/update operations.
- Resolve submodule remote defaults, attach only when the branch can end exactly at the parent gitlink, and return structured state.
- Turn incompatible strict closeout into a structured hard stop rather than apparent success.

**Non-Goals:**

- Auto-commit gitlinks, reset branches, force-push, discard local work, or reconcile divergent history.
- Change ordinary `finish` behavior when the new policy/flag is absent.
- Persist Pi session values in repository files; environment configuration is the persistent automation option.
- Change submodule remote URLs, default branches, or superproject gitlinks.

## Decisions

### Use one enum policy and one composite CLI flag

Add `finish.return-to-main=off|required`, with environment fallback `OPENSPEC_OPS_FINISH_RETURN_TO_MAIN` and default `off`. The deliver skill maps `required` to `finish <change> --return-to-main --json`. The composite CLI flag enables sync-primary, sync-submodules, and safe attachment plus strict outcome validation. This avoids an invalid matrix of booleans and makes the agent's final action auditable.

Alternative: three config booleans. Rejected because combinations such as attach without updating pins are difficult to define and cannot express strict all-or-stop semantics cleanly.

### Preserve direct one-shot flags and default behavior

Existing flags remain available and backward compatible. `--return-to-main` is additive. Without it and without old flags, finish performs no primary mutation. This keeps current operators safe and provides a migration path.

### Preflight predictable cleanliness, then synchronize after lifecycle-created commits

Strict mode checks primary cleanliness before destructive change-worktree closeout. Actual fetch/switch/ff-only pull and submodule synchronization remain after branch closeout so they see implementation and archive commits already on the remote base. Errors include whether the change worktree was already removed.

### Resolve and verify submodule defaults without branch replacement

Inventory initialized submodules recursively from each parent checkout's `.gitmodules`, retaining both the display path and immediate parent path so each gitlink is resolved from the correct parent commit. For every initialized submodule, query `refs/remotes/<remote>/HEAD`; if absent, use `git remote set-head <remote> --auto` after fetch and re-query. A missing/unresolvable default is an incompatible outcome. Attachment uses an existing local branch only when it can fast-forward exactly to the gitlink, or creates a missing local tracking branch at the remote-default tip and fast-forwards to the pin. It never uses `switch -C`, `reset`, or force.

The remote default tip must equal the gitlink or be an ancestor of it. If it is ahead of or diverged from the gitlink, strict closeout fails because “latest default branch” and “clean parent pin” cannot both hold.

### Report a stable closeout snapshot

Extend `sync` JSON with `required`, a `primary` snapshot, and `submodules[]` containing path, branch, HEAD, gitlink, remote default branch, and attach outcome. On strict incompatibility, throw a stable `return_to_main_needs_human` error whose details contain the partial snapshot and `worktreeRemoved`, allowing agents to explain the hard stop without scraping prose.

## Risks / Trade-offs

- **Remote default discovery may fail in restricted/offline environments** → fail closed with per-submodule `default_unresolved`; old non-strict flags/default remain available.
- **Strict sync can fail after the change worktree was removed** → preflight all local cleanliness first and include `worktreeRemoved` plus state diagnostics; do not roll back successful remote/lifecycle work.
- **Remote refs may change during closeout** → fetch immediately before resolution and verify final HEAD/gitlink equality.
- **Old consumers may only understand existing sync fields** → add fields without removing or renaming existing schemaVersion 1 fields.
