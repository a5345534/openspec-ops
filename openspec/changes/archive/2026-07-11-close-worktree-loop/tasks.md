## 1. Apply / archive path binding

- [x] 1.1 Extension: detect `/opsx-apply` (+ `/opsx:apply`); kebab name + alignment required → where/start; REQUIRED inject cwd=`W`; continue stock apply
- [x] 1.2 Extension: apply/propose without name → no false ensure; notify deferred binding
- [x] 1.3 Archive: docs + optional `/opsx-archive` handoff using decision tree (prefer W if changeDir under W; **never block** mainline/primary archive after merge solely because wt exists)
- [x] 1.4 Package apply skill/prompt: where.path preference (ops-* only)

## 2. Finish policy and doctor

- [x] 2.1 Dirty auto-finish skip message: commit/ship later or explicit force consent; no auto commit/merge
- [x] 2.2 Doctor: leftover dirty worktree without active change; optional primary-only artifacts when wt exists
- [x] 2.3 Unit tests for apply-intent parse helpers if extracted

## 3. Docs and verification

- [x] 3.1 README: full loop with **merge → archive → finish**; ship/PR follow-up; pure sidecar
- [x] 3.2 Tests green; no OpenSpec upstream source changes; no ship/merge implementation
