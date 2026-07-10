## 1. Helpers and tests

- [x] 1.1 Spike on this Pi version: `agent_settled` can run UI confirm + CLI; document degrade when `!hasUI` under policy `ask`
- [x] 1.2 Add `src/auto-finish/` pure helpers: archive-intent detect, change-name parse, `OPENSPEC_OPS_AUTO_FINISH` policy (`ask` default; `on`|`off`)
- [x] 1.3 Implement orphan decision helper from where JSON + policy → `keep_watch` | `clear_skip` | `notify_dirty_clear` | `confirm_finish` | `finish_now` | `ask_no_ui_skip` (hard conditions: where ok, `!dirty`, `changeDirExists === false`)
- [x] 1.4 Unit-test parse/policy/orphan matrix (still active keeps watch; orphan+ask; orphan+on; dirty; not_found; missing name; non-archive input)

## 2. Extension gate

- [x] 2.1 `input`: archive-intent + policy not `off` + parseable name → arm sticky watch; always continue (never `handled` for archive); never finish at input
- [x] 2.2 Optional arm-time `where` not_found → do not arm
- [x] 2.3 `agent_settled`: evaluate each watch via orphan helper + CLI where; keep watch when still active
- [x] 2.4 Policy `ask` + orphan clean: confirm → finish; decline → clear watch without finish; `!hasUI` → no silent finish
- [x] 2.5 Policy `on` + orphan clean: finish without confirm (no `--force`)
- [x] 2.6 Dirty inactive: notify skip, clear watch, no finish
- [x] 2.7 where not_found: clear watch, no finish
- [x] 2.8 Missing bin / finish failure: notify with `error.code` when available; never claim archive failed; never block archive input

## 3. Boundary and fallback

- [x] 3.1 Automation path does not load/expand `ops-finish` skill for happy path
- [x] 3.2 Verify manual `openspec-ops finish` and `/ops-finish` with `OPENSPEC_OPS_AUTO_FINISH=off`
- [x] 3.3 Confirm `.pi/prompts/opsx-archive.md` is not modified as the automation mechanism

## 4. Docs and verification

- [x] 4.1 Update README: watch vs orphan semantics, default `ask`, `on`/`off`, env, branch kept, skill fallback, kebab name required to arm, OpenSpec archive unchanged
- [x] 4.2 Smoke: multi-turn still-active → no finish; after inactive+clean ask accept/decline; `on` auto finish; dirty skip; no wt clear; off no-op
- [x] 4.3 Unit tests green; existing auto-ensure tests still pass
