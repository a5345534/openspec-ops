## 1. Shim core

- [x] 1.1 Implement argv parser: detect `new change <kebab>` amid flags; invalid/missing name → no ensure
- [x] 1.2 Implement real OpenSpec binary resolution (`OPENSPEC_REAL_BIN`, PATH skip self, clear error); unit tests for recursion safety
- [x] 1.3 Implement `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE` as **`on`|`off` only** (default `on`; no `ask` in v1)
- [x] 1.4 On intercept + policy on: `openspec-ops start <name> --json`; hard fail → do not spawn new change; success → spawn real openspec with cwd=worktree path; stderr worktree hint
- [x] 1.5 Pure forward for all other argv; preserve exit codes and stdio
- [x] 1.6 Ship bin as **`openspec-ops-intercept`** only (do not register global `openspec` in package.json bin); unit/integration tests with fake real bin + fake start

## 2. Extension review discovery

- [x] 2.1 On `agent_settled`, when `AUTO_REVIEW` on: discover changes with `proposal.md` under resolved roots even without slash arm
- [x] 2.2 One-shot: do not re-schedule follow-up for a change already scheduled in-session
- [x] 2.3 Policy off: no discovery fire
- [x] 2.4 Unit tests for discovery helpers where pure; keep existing review tests green

## 3. Spec/docs alignment

- [x] 3.1 Apply delta intent for slash ensure without name (no start at input)
- [x] 3.2 README: `openspec-ops-intercept`, alias/PATH, `OPENSPEC_REAL_BIN`, `INTERCEPT=on|off`, cwd limitation, slash vs intercept roles
- [x] 3.3 Smoke: intercept `new change foo --json` → start then change under worktree; `INTERCEPT=off` pure forward; invalid name no start

## 4. Verification

- [x] 4.1 Full test suite green
- [x] 4.2 Confirm no modifications to OpenSpec package source; only wrapper + openspec-ops
