## 1. Deferred Handoff Runtime

- [x] 1.1 Add a reusable next-task follow-up helper with exactly-once send and no automatic retry.
- [x] 1.2 Route both `/ops-next` and `/ops-deliver` through the helper while preserving `deliverAs: "followUp"`.
- [x] 1.3 Make success and failure notifications reflect synchronous handoff acceptance.

## 2. Regression Coverage

- [x] 2.1 Test compaction-adjacent/busy sequencing: handler returns before one deferred follow-up send.
- [x] 2.2 Test idle behavior, follow-up-only mode, synchronous rejection, notification ordering, and no retry.
- [x] 2.3 Keep extension integration checks for both guided slash commands and runtime binding.

## 3. Documentation and Verification

- [x] 3.1 Document the Pi 0.80.7 compatibility workaround, upstream issue #6728, limitation, and removal condition.
- [x] 3.2 Run OpenSpec validation, typecheck, build, targeted tests, full tests, and diff checks.
