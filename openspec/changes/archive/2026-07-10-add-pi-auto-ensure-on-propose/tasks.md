## 1. Spike and helpers

- [x] 1.1 Spike on this Pi version: confirm `input` async ensure-then-`continue` runs before `/opsx-propose` prompt expansion; document result in design notes if API differs
- [x] 1.2 Implement pure helpers (policy parse, propose-intent detect, change-name parse) with unit tests
- [x] 1.3 Implement `resolveBin` + `runOps` JSON/exit wrapper (reuse CLI contract; no raw git worktree)

## 2. Extension gate

- [x] 2.1 Add `.pi/extensions/` module registering `input` (or validated equivalent) handler for propose-intent
- [x] 2.2 Implement `ensureWorkspace(change)`: where → start when needed; default policy `on`; honor `OPENSPEC_OPS_AUTO_START`
- [x] 2.3 On ensure success: optional non-blocking notify with path; release original input to stock propose
- [x] 2.4 On ensure hard failure: do not continue propose; surface `error.code`
- [x] 2.5 On unparseable change name or policy `off`: no ensure side effects; continue propose
- [x] 2.6 Implement policy `ask` path (confirm only when worktree missing)

## 3. Context and manual entry

- [x] 3.1 Optional `before_agent_start` one-line inject of active workspace path after ensure
- [x] 3.2 Keep/verify explicit manual start still works (CLI and existing `/ops-start` skill/prompt); optionally register deterministic ops commands without forking propose

## 4. Docs and verification

- [x] 4.1 Update root README: default-on ensure-before-propose, `OPENSPEC_OPS_AUTO_START=off`, OpenSpec unchanged
- [x] 4.2 Manual smoke: on + missing wt → start + propose continues; on + existing wt → reuse; off → no start; conflict → abort
- [x] 4.3 Confirm extension does not modify `.pi/prompts/opsx-propose.md` as the automation mechanism
