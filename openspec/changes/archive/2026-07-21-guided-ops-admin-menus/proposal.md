## Why

Operators must memorize `/ops-config` and `/ops-metrics` subcommand DSL to manage preferences and local metrics, and the only non-session persistence for policies such as `finish.return-to-main` is an environment variable. That friction blocks a common desire: set strict return-to-main once in Pi and keep it across restarts without shell config. Empty slash entry should navigate like `/ops-next`, and user-local preferences should live under the Pi agent directory—not in the repo and not only in env.

## What Changes

- Add a **user-local ops-config store** under the Pi agent directory (alongside metrics config), with precedence **session > user > env > default**.
- Support persisting known keys (including `finish.return-to-main`, `spec-review.max-rounds`, `impl-review.max-rounds`) as **user** preferences without environment variables.
- **Empty** `/ops-config` in interactive UI opens a **guided menu** (show / edit key / clear session / clear user); explicit args remain direct.
- **Empty** `/ops-metrics` in interactive UI opens a **guided menu** (status, enable/disable, report, export, database, reset); explicit args remain direct.
- Destructive metrics actions invoked via the menu use **`ui.confirm`** instead of requiring the operator to type a `confirm` token; string `… confirm` paths stay for no-UI/scripts.
- Injected effective config reports `source=user` when applicable; built-in default for `finish.return-to-main` remains **`off`**.
- **Non-goal / not changed:** product built-in default flip to `required`; CLI `openspec-ops finish` does not silently read the user store; no repo project config file; no single umbrella `/ops` command.
- **BREAKING (small, interactive only):** bare `/ops-config` and `/ops-metrics` with UI no longer jump straight to `show`/`status`; they open the menu. Bare commands without UI keep text catalog / status-style fallback. Explicit subcommands are unchanged.

## Capabilities

### New Capabilities

- `ops-admin-menus`: Shared interactive admin menu behavior for empty `/ops-config` and `/ops-metrics` (select/confirm/input, text fallback, direct-args bypass).

### Modified Capabilities

- `ops-config`: User-local persistence layer, `source=user`, menu entry for empty command, session vs user save/clear semantics; document non-session-only v1 supersession.
- `ops-lifecycle-metrics`: Empty `/ops-metrics` menu entry, UI confirm for destructive paths, compatibility of direct subcommands and no-UI fallback.

## Impact

- Extension: `.pi/extensions/openspec-ops-guided.ts` (`ops-config`, `ops-metrics` handlers).
- Config core: `src/pi-config/store.ts` (and related exports/tests).
- Metrics command UX only (storage/collection semantics largely unchanged); optional small helpers for menu/confirm.
- Specs/README: ops-config session-only wording, metrics controls, inject text for `source=user`.
- Skills/prompts that mention ops-config usage may note menu + user preference; deliver/finish still consume **effective** policy only (no new consent model).
- Tests: pi-config precedence, user file IO, extension menu/direct-arg paths where covered today.
