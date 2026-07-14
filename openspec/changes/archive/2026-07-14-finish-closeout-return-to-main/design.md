## Context

`openspec-ops finish` closes a **change workspace**: remove linked worktree, optionally prune parent branch when a merged PR is verified. It deliberately does **not** mutate the operator’s primary checkout (no `git pull`, no submodule re-init on primary). That is safe, but monorepo operators (AOS parent + implementation submodule) repeatedly treat post-deliver state as a bug:

- Primary lags `origin/main` after merge → looks like merge failed.
- After `git submodule update`, submodule is **detached at parent gitlink** (correct Git) while local branch `main` may be stale → looks like “HEAD corrupted.”

Issue #24 frames this as a **stricter operator DoD** (“return to main”) than the current contract. Issue #22 covers teardown failures and submodule **feature-branch** prune—orthogonal to primary sync.

Today:

- `runFinish` → prepare/deinit → remove worktree → parent branch cleanup only.
- `runDoctor` probes submodules only on **linked** worktrees; no `primary_behind_origin`.
- README documents parent vs submodule branch model for *change* worktrees, not post-success primary closeout.

## Goals / Non-Goals

**Goals:**

1. Document success boundary and monorepo closeout checklist.
2. Doctor (and optional finish hints) surface residual primary/submodule hygiene without mutating state.
3. Opt-in finish (and deliver pass-through) flags for safe primary ff-sync and submodule update/attach.
4. Keep defaults non-mutating; refuse dirty/non-ff; never force-push or rewrite submodule history.

**Non-Goals:**

- Force-push submodule `origin/main` to match gitlink.
- Replace gitlink SSOT with “always track branch main.”
- Auto-sync when primary is dirty.
- Change OpenSpec archive/merge/ship semantics.
- Fix #22 teardown or submodule feature-branch prune.
- Force-finish policy changes; nested submodule recursion beyond existing top-level scope for probes/update.

## Decisions

### 1. Phased delivery: docs/doctor first, automation second

| Phase | Scope |
|-------|--------|
| A (Must) | README + CLI help; doctor issues; finish human/JSON hints when residuals detectable after default finish |
| B (Should) | `--sync-primary`, `--sync-submodules`, optional attach-if-safe |

Rationale: most false bug reports die with docs + signals; automation is higher risk and can land once signals exist.

### 2. Default base ref for “behind” and sync

Use the same base resolution as ship/start (`resolveBase` / default branch of primary, typically `main`, tracking `origin/<base>`). Doctor “behind” compares `primary HEAD` (or tip of checked-out branch) to `origin/<base>` when the remote-tracking ref is available; if fetch is stale, document that operators may need `git fetch`—doctor MUST NOT fetch by default (read-only, no network surprise).

**Alternative considered:** doctor always `git fetch` → rejected (mutates remote-tracking refs / network / slow).

### 3. Doctor issue model

New stable ids (extend `DoctorIssue.id`):

| id | severity | when |
|----|----------|------|
| `primary_behind_origin` | warning | primary tip is strictly behind `origin/<base>` (reachable ancestor) and remote-tracking ref exists |
| `primary_submodule_detached` | info | primary top-level submodule detached and clean (expected after update @ pin) |
| `primary_submodule_detached_dirty` | warning | primary submodule detached and dirty |
| `primary_submodule_main_diverged` | warning | optional: local/origin `main` (or configured branch) does not contain gitlink / diverged from pin when attach policy would care |

Reuse existing probe helpers on `primaryPath` in addition to linked worktrees. Fail-open on probe errors. Doctor exit code remains 0 when issues present.

**Alternative:** overload `submodule_detached` for primary → rejected (path ambiguity and different operator action).

### 4. Finish opt-in post-hooks (ordered)

After existing teardown + parent branch cleanup **succeeds**:

```text
1. existing: remove worktree + parent branch cleanup (#22 teardown separate)
2. if --sync-primary: require clean primary; switch/stay default base; pull --ff-only origin/<base>
3. if --sync-submodules: git submodule update --init --recursive on primary
4. if --attach-submodule-main (or config finish.attachSubmoduleMain=if-safe):
     for each top-level sub: if origin/main (or main) equals gitlink OR gitlink is ff from main tip without rewrite
       → switch main + ff to gitlink
     else → leave detached; record submodule_main_diverged warning; never reset --hard / force-push
5. emit closeout hints in result (even when flags off): primaryBehind, submodule notes
```

Flags default **off**. CLI names preferred for v1 (`--sync-primary`, `--sync-submodules`, `--attach-submodule-main`); config keys (`finish.syncPrimary`, …) MAY follow later via ops-config—not required for first ship.

**Refuse** with clear `CliError` codes when sync requested and unsafe, e.g.:

- `primary_dirty` — sync-primary refused
- `primary_diverged` / non-ff pull failure
- `primary_not_on_base` if switch fails (optional: try `git switch <base>` only when clean)

Sync failure after worktree already removed: worktree closeout MUST remain successful; report sync as separate failed step in result or exit non-zero with details that distinguish “workspace finished, sync failed.” Preferred: exit non-zero with `error.code` like `sync_primary_failed` and `details.worktreeRemoved: true` so deliver can surface residual without re-running destructive finish.

**Alternative:** best-effort sync always → rejected (violates consent, dirty primary risk).

### 5. Deliver skill surface

- Document checklist and “GitHub success ≠ local primary.”
- Pass sync flags to finish **only** when operator/session config opts in (not default batch path).
- Deliver success = lifecycle stations complete; do not fail deliver solely because primary is behind when sync was not requested.

### 6. Implementation sketch (modules)

- `src/doctor/primary-closeout.ts` (or extend `doctor.ts`): behind-origin check + primary submodule probe → issues.
- `src/commands/finish-sync.ts`: pure functions for sync-primary / submodule update / attach-if-safe; injected git runner for tests.
- Wire flags in `cli.ts` + `FinishOptions` / `FinishResult`.
- README sections under Submodules + Finish/Deliver.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Expanding finish beyond “workspace closeout” confuses mental model | Docs: default finish unchanged; sync is explicit opt-in post-hook |
| `pull --ff-only` fails after worktree gone | Clear error; do not roll back branch prune; operator can pull manually |
| Attach-to-main mis-detects “safe” and moves branch | Strict equality or ancestor check only; never force; tests for diverged case |
| Doctor false positives without fetch | Hint “run git fetch”; severity warning not error |
| Scope creep into #22 | Explicit non-goal; cross-link only |
| Recursive submodule update surprises | Match `git submodule update --init --recursive` only when flag set; document |

## Migration Plan

1. Ship Phase A (docs + doctor) — no behavior change for finish defaults.
2. Ship Phase B (flags) — default off; existing scripts unchanged.
3. Optional later: session config defaults for deliver in monorepos.

Rollback: remove flags / ignore issues; no data migration.

## Open Questions

1. ~~Exact CLI flag for attach~~ — **resolved:** `--attach-submodule-main` for v1.
2. Whether finish JSON always includes `closeoutHints` object even when empty — prefer yes for agent parse stability.
3. ops-config keys in same change vs follow-up — defer config keys if CLI flags alone meet acceptance.

## Spec coherence notes

- Main-spec requirement “No automatic submodule branch or commit” is **MODIFIED** in the hygiene delta so default finish remains non-mutating while explicit primary closeout flags may act on primary only.
- Doctor issue `primary_submodule_main_diverged` remains optional for Phase A; attach path in Phase B MUST still surface diverged via finish result/warning even if doctor id ships later.
