## 1. Docs (Phase A)

- [x] 1.1 README: deliver/finish success ≠ primary pulled; monorepo checklist (checkout base, `pull --ff-only`, `submodule update --init`); detached-at-gitlink is normal
- [x] 1.2 Cross-link issue #22 teardown vs this return-to-main DoD; mention optional future sync flags
- [x] 1.3 ops-deliver skill/prompt: lifecycle success vs return-to-main; no default sync flags

## 2. Doctor signals (Phase A)

- [x] 2.1 Add `primary_behind_origin` detection (local `origin/<base>` only; no fetch; fail-open if missing)
- [x] 2.2 Probe primary top-level submodules; emit `primary_submodule_detached` / `primary_submodule_detached_dirty`
- [x] 2.3 Extend `DoctorIssue` id union + any exit/message maps (include new primary_* ids)
- [x] 2.4 Unit tests for behind / up-to-date / missing remote-tracking / primary submodule issues
- [x] 2.5 Keep linked-worktree `submodule_detached*` ids unchanged (do not overload for primary)

## 3. Finish hints without mutation (Phase A)

- [x] 3.1 After default finish success, optionally include closeout hints when primary is detectably behind (no pull)
- [x] 3.2 Human lines point at doctor + checklist when hints present

## 4. Opt-in sync flags (Phase B)

- [x] 4.1 CLI: `--sync-primary`, `--sync-submodules`, `--attach-submodule-main` (default off) on finish
- [x] 4.2 Implement sync-primary: clean check, switch/stay base, `pull --ff-only`; refuse dirty/diverged with stable error codes
- [x] 4.3 Implement sync-submodules: primary `git submodule update --init --recursive`
- [x] 4.4 Implement attach-if-safe only; diverged → warn, no force
- [x] 4.5 Finish result fields for sync outcomes; if worktree removed but sync fails, surface clearly
- [x] 4.6 Unit tests: happy ff path, dirty refuse, diverged refuse, attach match vs diverge
- [x] 4.7 CLI help + README flag docs

## 5. Deliver surface (Phase B docs)

- [x] 5.1 Document how operators opt into sync (flags/config); default deliver path unchanged
- [x] 5.2 Ensure deliver skill does not pass sync flags unless explicitly enabled

## 6. Verify

- [x] 6.1 `npm test` green for new + existing doctor/finish suites
- [x] 6.2 Manual sanity: doctor on a behind primary (or mocked); finish without flags does not pull
