# Change: ops-deliver

## Why

The guided lifecycle is complete step-by-step (`/ops-next` + individual skills), but operators still re-type many slashes from worktree start through finish. After **explore** is done, they want one explicit command that runs the **happy path end-to-end**, without reviving background auto-ensure/review.

Locked product rules:

1. **Boundary:** After explore; pipeline is **start → finish** (not explore).
2. **Merge:** Invoking deliver **is consent** to squash-merge when gates pass (no second merge prompt).
3. **Reviews:** **spec-review and impl-review always run**; cannot skip; needs-human stops the pipeline.

## What Changes

- New skill/prompt **`/ops-deliver <change>`** (optional short objective text later): orchestrates existing ops/opsx steps using lifecycle station detection.
- Pipeline order (default happy path):

  ```text
  start → propose → spec-review → apply → ship → impl-review → merge → archive → finish
  ```

- **Idempotent resume:** re-run deliver on same change continues from current station (no duplicate merge if already merged).
- **Hard stops:** spec-review or impl-review needs-human; ship/merge/gh failures; dirty finish without force; max step guard.
- **Never auto `--force` finish.** Never skip reviews. Never run explore inside deliver.
- Package: export `ops-deliver` skill in `package.json` `files` + `pi.skills` allowlist pattern already `ops-*`.
- Docs: README loop documents `/ops-deliver` vs `/ops-next`; contrast with retired auto-*.
- Optional thin helper in `src/next-step/` for “default next action for deliver” (auto edge pick) if useful for tests; orchestration remains skill-driven (LLM steps for propose/apply/reviews).

## Capabilities

### New Capabilities

- `ops-deliver`: end-to-end deliver orchestrator skill and rules (start→finish; mandatory reviews; merge consent via invoke)

### Modified Capabilities

- `guided-next-step`: coexist with deliver; deliver uses station machine; next remains manual single-step
- `pi-ops-skills`: ops-deliver skill packaging and docs
- `worktree-loop-closure`: document deliver as optional batch path on top of merge→archive→finish

Merge consent-via-deliver is specified under **ops-deliver** (does not require a separate ops-merge delta; merge CLI behavior unchanged).

## Impact

- New skill primarily; possible small pure helper + tests for deliver edge selection
- Long agent sessions; operators must understand merge consent scope
- Does not remove `/ops-next` or individual skills

## Non-goals

- Embedding explore in the pipeline
- Skip flags for reviews (no `--skip-spec-review` / `--skip-impl-review` in v1)
- Auto force-finish dirty trees
- Replacing OpenSpec propose/apply implementation with pure CLI
- Goal-runner DAG integration (may come later)
