# Design: ops-next-pr-signals

## Bug

```ts
// openspec-ops-guided.ts today
const hasOpenPr = false;
const hasMergedPr = false;
```

## Fix

```text
resolveSignals(change, roots, whereResult):
  branch = where.branch || change
  cwd = where.primaryPath || where.path || first root
  hasOpenPr = softFindOpenPr(cwd, branch)
  hasMergedPr = softFindMergedPr(cwd, branch)
```

### Soft wrappers

`findOpenPullRequest` currently **throws** on gh failure. For next-step:

```ts
function softOpenPr(cwd, head): boolean {
  try { return findOpenPullRequest(cwd, head) != null }
  catch { return false }
}
function softMergedPr(cwd, head): boolean {
  try { return resolveMergeStatusBackend("gh").findMergedPullRequest({cwd, head}) != null }
  catch { return false }
}
```

Optional: `notify` once if both soft-fail and tasks complete (“PR status unavailable; station may lag”).

## Placement

Prefer `src/next-step/pr-signals.ts` exporting `resolvePrSignals({ cwd, head })` for testability; extension calls it after `where`.

## Priority (unchanged in stations.ts)

```text
merged (hasMergedPr && active) > shipped (hasOpenPr) > applied (tasks done)
```

If both open and merged somehow, open list empty and merged true → merged. Fine.

## Tests

- softOpen true/false/throw
- integration: detectLifecycleStation with hasOpenPr true → shipped
