## Why

openspec-ops can create a change worktree and partially guide writes, but the end-to-end loop is still leaky: apply often runs on primary, archive cwd is ambiguous, and post-archive auto-finish only removes a clean worktree—without a documented **default delivery order** or strong apply path binding. Teams need a **closed worktree loop** that matches **merge → archive → finish** (not archive-before-merge), without implementing commit/PR/merge in this change.

## What Changes

- **Document and implement the default loop (worktree segment + documented git order):**

  ```text
  start/ensure
    → propose (writes in W)
    → optional plan review
    → apply (in W)
    → [ops-ship: commit/push/PR — follow-up change]
    → human/CI review
    → merge into main
    → archive
    → finish (when clean)
  ```

  **Merge is before archive.** Ship/merge automation is **out of scope** here (follow-up).

- **Apply path binding:** On strong `/opsx-apply` / `/opsx:apply` with parseable kebab name and alignment required → where/start + **REQUIRED** cwd=`W`; continue stock apply. No name → no false ensure; deferred notice.

- **Archive path rules (decision tree):**
  - If active change directory still lives under worktree `W` (typical pre-merge) → harness/docs prefer archive ops with cwd=`W`
  - **Default after merge** → archive on the **mainline checkout** (often primary) that holds `openspec/specs`
  - Extension MUST NOT hard-block archive on primary when following merge-then-archive
  - Archive-before-merge is non-default and not automated here

- **Post-archive finish:** clean + inactive → may auto-finish; dirty → no `--force`; message points to commit/ship or explicit force consent; **never** commit/merge

- **Doctor:** leftover dirty worktree after archive; optional primary-only artifacts when wt exists

- **Docs:** full loop; ops-ship follow-up; pure sidecar

## Capabilities

### New Capabilities
- `worktree-loop-closure`: Apply/archive path binding and finish policy for the worktree loop; merge-then-archive as default order

### Modified Capabilities
- `worktree-write-alignment`: Apply path binding; merge-before-archive documentation
- `pi-auto-finish-on-archive`: Dirty skip messaging; finish never ships
- `pi-ops-skills`: Apply skill prefers `where.path` (ops-* assets only)

## Impact

- **Code:** extension apply (+ light archive handoff), finish copy, doctor, README, apply skill markers
- **Non-impact:** no commit/push/PR/merge; no OpenSpec fork; no openspec-* package export
