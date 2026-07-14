## Why

After `/ops-deliver` (or ship → merge → archive → finish), operators often treat success as: primary checkout is on `main`, matches `origin/main`, and submodules are in a predictable state—not “mystery detached.” openspec-ops intentionally does **not** auto-pull the primary worktree, so monorepo deliver runs repeatedly look “broken” even when GitHub `main` is correct (issue #24). We need a productized **return-to-main** closeout contract: clear docs, doctor signals, and opt-in safe sync—without weakening safety defaults.

## What Changes

- Document deliver/finish success boundary: GitHub merge success ≠ primary worktree updated; monorepo closeout checklist (pull ff-only + submodule update; expect detached @ gitlink unless attach policy is used).
- Extend `doctor` to report when primary is behind `origin/<default-base>` (`primary_behind_origin`) and, for primary top-level submodules, distinguish clean detached-at-pin (info OK) vs dirty/diverged pin hygiene (warn).
- Add **opt-in** finish flags (default **off**):
  - `--sync-primary`: clean primary only → switch/stay on default base + `pull --ff-only`; refuse dirty/diverged.
  - `--sync-submodules`: `git submodule update --init --recursive` on primary after optional primary sync.
  - Optional non-destructive attach of submodule to `main` only when gitlink equals or is ff-reachable from that branch; never force-reset or force-push.
- Deliver/skills docs: success remains lifecycle completion; residual primary lag is a hint unless sync flags were requested and failed.
- Cross-link issue #22 (teardown / submodule feature-branch prune) as separate work; this change does not fix teardown.

## Capabilities

### New Capabilities
- `primary-closeout-sync`: Opt-in primary + submodule closeout sync after finish (and deliver documentation/flags surface); safety gates (clean, ff-only, no force history rewrite).

### Modified Capabilities
- `finish-closeout`: Default finish remains worktree + merged parent branch cleanup only; document non-sync default; accept opt-in sync flags without changing merge/archive semantics.
- `workspace-lifecycle`: Doctor issue catalog includes `primary_behind_origin` (and remains exit 0 with issues).
- `worktree-submodule-hygiene`: Document detached-at-gitlink as normal; doctor may report primary submodule pin hygiene (info vs warn); no auto-commit.
- `ops-deliver`: Document return-to-main DoD vs current contract; optional pass-through of sync flags when operator enables them (no default auto-sync).

## Impact

- CLI: `finish` options + result fields/hints; `doctor` issue ids and primary probe.
- README / finish help / deliver skill docs.
- Types: `DoctorIssue` ids; optional `FinishResult` closeout hints.
- Tests: doctor primary-behind; finish sync refuse dirty/diverged; safe attach path.
- Does **not** change OpenSpec archive, merge, ship, or force-finish policy.
- Related but out of scope: #22 submodule teardown robustness and submodule feature-branch prune.
