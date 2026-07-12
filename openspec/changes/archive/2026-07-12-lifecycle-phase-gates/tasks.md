## 1. Phase detection and spec-review skill

- [x] 1.1 Add testable helper to detect archive presence / active change roots for a change name
- [x] 1.2 Update ops-spec-review skill: phase check first; refuse archived without override; optional soft post-apply warn
- [x] 1.3 Unit tests for archive-only refuse and active+archive detection inputs

## 2. Doctor and docs

- [x] 2.1 Doctor: emit **`change_location_mismatch`** with remediation hint; types union
- [x] 2.2 README: merge → archive on mainline; residual active footgun; do not re-spec-review after archive
- [x] 2.3 Confirm auto-review still propose-only (no code path arms on archive)

## 3. Verification

- [x] 3.1 Tests green; no auto-delete of primary active dirs; no OpenSpec archive rewrite
