## 1. User preference store and precedence

- [x] 1.1 Extend `ConfigSource` with `user` and load/save flat known-key map at `<agentDir>/openspec-ops/config.json` (mode 0600; ignore invalid keys)
- [x] 1.2 Update effective resolution to `session > user > env > default` for max-rounds keys and `finish.return-to-main`
- [x] 1.3 Add APIs for set/unset user values and reset user store; keep session `reset` session-only
- [x] 1.4 Update `formatConfigInjection` / show output for `source=user` and session-vs-user docs strings
- [x] 1.5 Unit tests for precedence, persistence round-trip, invalid file resilience (`tests/pi-config.test.ts` or equivalent)

## 2. Direct ops-config CLI surface

- [x] 2.1 Parse `/ops-config set|unset|reset` with `--user` (or documented equivalent) without requiring a project file
- [x] 2.2 Preserve existing session-only `set`/`unset`/`reset`/`get`/`show` behavior
- [x] 2.3 Reject invalid values for user writes the same as session writes

## 3. Shared admin menu helpers

- [x] 3.1 Add small helpers for select menus, cancel handling, text-catalog fallback (aligned with `/ops-next`)
- [x] 3.2 Wire destructive paths to `ui.confirm` when invoked from menus

## 4. Guided `/ops-config` menu

- [x] 4.1 Empty args + hasUI → root menu (show, edit, clear session, clear user, cancel)
- [x] 4.2 Edit flow: pick key → pick/enter value → save session vs user
- [x] 4.3 Empty args + !hasUI → non-blocking text catalog / effective listing; no accidental clears
- [x] 4.4 Explicit args never open root menu

## 5. Guided `/ops-metrics` menu

- [x] 5.1 Empty args + hasUI → root menu (status, on/off, report, export, database, reset, cancel)
- [x] 5.2 Report/export/database subflows with `ui.input` where needed; call existing metrics functions
- [x] 5.3 Menu reset/rebuild/destroy require interactive confirm; direct `… confirm` tokens unchanged
- [x] 5.4 Empty args + !hasUI → text catalog / status summary; no destructive side effects
- [x] 5.5 Explicit args never open root menu

## 6. Docs and regression

- [x] 6.1 Update README ops-config section: precedence, user store path, menu entry, `--user` examples; default `finish.return-to-main` still off
- [x] 6.2 Note bare interactive command behavior change; CLI finish does not read user store
- [x] 6.3 Extension/export-surface or handler tests for menu vs direct paths as far as existing harness allows
- [x] 6.4 Run relevant unit tests and fix regressions
