## 1. Core ship command

- [x] 1.1 Types + CLI: add `ship` command name, flags (`--message`, `--title`, `--body`, `--draft`, `--remote`, `--base`, `--backend`), help text; error codes (`nothing_to_ship`, `pr_backend_unavailable`, `pr_failed`, `submodule_detached_dirty`)
- [x] 1.2 PR backend **sync** interface + `gh` adapter (`createOrReuse`); fail if `gh` missing
- [x] 1.3 `runShip` state machine: where → detached-dirty abort / clean-detached warn → dirty:`add -A`+commit default `ship(<change>): worktree` → push (no force) → PR; push-ok/PR-fail non-zero + retryable; existing PR short-circuit
- [x] 1.4 Tests: happy path mocked git/gh; nothing_to_ship; not_found; detached dirty aborts; clean detached warns/continues; no force push; PR-fail after push leaves no extra commit requirement on retry

## 2. Package surface and docs

- [x] 2.1 ops-ship skill + prompt (shared runtime rules; no merge; consent note)
- [x] 2.2 Verify package.json globs already pick up `ops-ship` (no config change unless needed)
- [x] 2.3 README: loop includes ship; flags; default message; gh requirement; submodule preflight; push/PR failure retry; non-goals (no merge)

## 3. Verification

- [x] 3.1 Tests green; no auto-merge; finish still does not commit
- [x] 3.2 Manual smoke optional: ship on fixture or fully mocked path
