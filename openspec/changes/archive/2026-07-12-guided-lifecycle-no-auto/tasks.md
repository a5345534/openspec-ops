## 1. Delete auto machinery

- [x] 1.1 Remove `src/auto-ensure`, `src/auto-review`, `src/auto-finish`, `src/auto-impl-review` and corresponding tests
- [x] 1.2 Remove `OPENSPEC_OPS_AUTO_*` from README, doctor env checks, and any config docs
- [x] 1.3 Gut or replace Pi extension: delete propose ensure, review watches/settle fire, finish watches/auto-finish; keep only what guided next-step needs
- [x] 1.4 Remove intercept auto-ensure (no ensure-before-new-change); passthrough-only or delete intercept surface per minimal breakage
- [x] 1.5 Strip skills/prompts: ship auto-impl-review; propose/ensure/review auto language; finish auto references

## 2. Guided next-step core

- [x] 2.1 Add `src/next-step/` stations + hard-coded edges + menu formatting (unit tests for edges table and applied/shipped exclusions/inclusions)
- [x] 2.2 Station detection using where/fs/PR signals with safe fallback
- [x] 2.3 `/ops-next` skill (+ prompt if needed): select UI when available, else text menu; no silent follow-up
- [x] 2.4 Wire lifecycle skills to hand off to `/ops-next` after success

## 3. Docs and package surface

- [x] 3.1 Rewrite README happy path / extension sections for guided flow; remove auto tables
- [x] 3.2 Update package export / doctor tests broken by deletions
- [x] 3.3 Ensure full test suite green

## 4. Spec hygiene

- [x] 4.1 Confirm delta REMOVED/MODIFIED titles match main spec headers at archive (openspec-cli-intercept + pi-auto-*)
- [x] 4.2 After code delete, grep tree for OPENSPEC_OPS_AUTO_ and auto-review settle fire (must be gone)
