## 1. Readiness helper

- [x] 1.1 Add `isAutoReviewEligible(change, roots)` (proposal + tasks incomplete/missing + phase ok)
- [x] 1.2 Checkbox parse helper with unit tests (open vs all done vs no boxes)
- [x] 1.3 Use eligibility in `discoverReadyProposalChanges` and `isProposalReady` call sites for fire (keep raw proposal helper if needed)

## 2. Extension settle

- [x] 2.1 Filter settle candidates through eligibility; clear ineligible watches without scheduling
- [x] 2.2 Unit/integration coverage for “all tasks [x] ⇒ no follow-up”

## 3. Docs

- [x] 3.1 README auto-review: proposal + pre-apply eligibility (skip all tasks complete)
