## 1. Session config

- [x] 1.1 Add session config store (`get`/`set`/`unset`/`reset`/`show`) with precedence session > env > default; key `spec-review.max-rounds` default 3; env `OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS`; clamp 1–10
- [x] 1.2 Register Pi command `/ops-config` (show/get/set/unset/reset); no project config files; document session-only
- [x] 1.3 Inject effective config into agent context (before_agent_start or equivalent)
- [x] 1.4 Unit tests for precedence (session/env/default) and validation

## 2. ops-spec-review skill loop

- [x] 2.1 Add `.pi/skills/ops-spec-review` + prompt: iterative major-only fix loop, direct artifact edits, max rounds from config, worktree where alignment, change-root only; major checklist + “uncertain → minor”
- [x] 2.2 **Delete** `.pi/skills/ops-review/` and `.pi/prompts/ops-review.md` (no redirect)
- [x] 2.3 Set review slash to `/ops-spec-review` in `ready.ts` + extension follow-up; grep-replace old `/ops-review` in comments/docs/tests

## 3. Docs and verification

- [x] 3.1 README: loop propose → ops-spec-review → apply; ops-config; auto-review runs **full** fix loop (cost note; AUTO_REVIEW=off); env max-rounds
- [x] 3.2 Tests green for config store; package surface has ops-spec-review and not ops-review
- [x] 3.3 No project config file; finish/ship/prune untouched
