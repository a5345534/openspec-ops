## 1. Implementation

- [x] 1.1 Add soft PR signal helper (`resolvePrSignals` / soft open+merged)
- [x] 1.2 Wire extension `/ops-next` to set hasOpenPr/hasMergedPr from helper (branch from where)
- [x] 1.3 Unit tests: open → shipped options path; throw → false; no hardcode left
- [x] 1.4 ops-next skill one-line: station uses gh PR state when available

## 2. Verify

- [x] 2.1 Tests green; grep extension for `hasOpenPr = false` hardcode gone
