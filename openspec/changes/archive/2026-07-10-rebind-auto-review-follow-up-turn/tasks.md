## 1. Helpers and tests

- [x] 1.1 Confirm project ops-review slash entrypoint (`/ops-review` vs `/skill:ops-review`) and document in design spike notes if needed
- [x] 1.2 Add `src/auto-review/` helpers: `parseAutoReviewPolicy` (default `on`), readiness check `proposal.md` exists for change under configurable roots
- [x] 1.3 Unit-test policy + readiness (missing dir, proposal present/absent, case-insensitive off)

## 2. Extension rebind

- [x] 2.1 On propose-intent + parseable name + review policy on: arm sticky `reviewWatches` **before/without** requiring ensure success; never handle propose for review reasons
- [x] 2.1b When ensure hard-aborts propose (`handled` / missing bin / conflict), clear that change from `reviewWatches` (no zombie watch, no followUp)
- [x] 2.2 Remove ensure-coupled `pendingReviewChange` same-turn review inject as primary path (delete or hard-disable review lines in `before_agent_start`)
- [x] 2.3 On `agent_settled`: for each review watch, if not ready keep; if ready clear watch and `sendUserMessage` followUp to run ops-review for that change
- [x] 2.4 Policy off: do not arm; clear watches; no followUp
- [x] 2.5 Guard: do not re-arm review from extension-sourced messages; ignore non-propose slash (e.g. `/ops-review`) for watch arm
- [x] 2.6 If `sendUserMessage` unavailable, notify and skip without throwing; propose path unaffected

## 3. Docs and verification

- [x] 3.1 Update README auto-review section: follow-up turn, ensure-independent arm, readiness, off switch, no mechanical CLI
- [x] 3.2 Smoke: slash propose with name → write proposal → settle → followUp `/ops-review`; without proposal no fire; `AUTO_REVIEW=off` no arm
- [x] 3.3 Unit tests green; auto-ensure and auto-finish tests still pass
