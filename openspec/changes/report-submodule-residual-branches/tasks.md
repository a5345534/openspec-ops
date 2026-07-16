## 1. Diagnostic Model and Probe

- [x] 1.1 Add stable submodule branch diagnostic types and an always-present finish result array.
- [x] 1.2 Implement a bounded fail-open probe for matching local and remote-tracking refs in checked-out top-level submodules.
- [x] 1.3 Cover multiple submodules/remotes, current-branch state, absent refs, and per-probe failures without network or mutation.

## 2. Finish Integration

- [x] 2.1 Capture diagnostics before submodule preparation/removal and preserve them through successful parent closeout.
- [x] 2.2 Return an empty diagnostic array for branch-only finish and no-match/probe-failure paths.
- [x] 2.3 Verify default finish does not switch, delete, fetch, push, or otherwise mutate submodule branches.

## 3. Documentation and Verification

- [x] 3.1 Document parent-only branch cleanup, remote-tracking limitations, and safe manual verification.
- [x] 3.2 Add exact JSON/result and human-output coverage for residual diagnostics.
- [x] 3.3 Run OpenSpec validation, type checking, targeted tests, and the full project test suite.
