## Context

Today `/ops-config` is an in-memory session Map with precedence `session > env > default`. Values reset when Pi restarts; persistent opt-in for `finish.return-to-main` requires `OPENSPEC_OPS_FINISH_RETURN_TO_MAIN`. `/ops-metrics` already persists enablement and SQLite path under `~/.pi/agent/openspec-ops/metrics-config.json`, but both admin surfaces require memorizing subcommands. `/ops-next` already demonstrates `ui.select` + text fallback.

Operators want: empty slash → menu; set `finish.return-to-main=required` once in Pi without env; keep built-in default `off` so primary checkouts stay non-mutating unless preferred.

## Goals / Non-Goals

**Goals:**

- User-local preference store for known ops-config keys under the Pi agent directory.
- Precedence: **session > user > env > default**; inject `source=user` when effective.
- Empty `/ops-config` and `/ops-metrics` open guided menus when UI is available.
- Explicit args remain direct (script/agent-friendly).
- Menu destructive metrics paths use `ui.confirm`; string `confirm` tokens remain for no-UI.
- Shared menu helper pattern aligned with `/ops-next` (no new npm dependency).

**Non-Goals:**

- Changing built-in `finish.return-to-main` default to `required`.
- Teaching bare CLI `openspec-ops finish` to read the user store (Pi effective policy + flags only).
- Project/repo config files for ops-config.
- Umbrella `/ops` command merging lifecycle + admin.
- Metrics time-range report UI or new aggregation features.
- Localized menu labels (keep English admin labels consistent with current notifies).

## Decisions

### 1. User store location and shape

- **Path:** `<agentDir>/openspec-ops/config.json` (same root as metrics; mode `0600`).
- **Shape:** flat map of known keys → string values, e.g.  
  `{ "finish.return-to-main": "required", "spec-review.max-rounds": "5" }`.
- **Rationale:** mirrors metrics-config locality; flat keys match `/ops-config` DSL and avoid dual schemas.
- **Alternatives:** env-only (rejected by operator); project `.pi/` file (rejected by ops-config “no project file”); nested JSON objects (more mapping noise).

### 2. Precedence and API surface

- Extend `ConfigSource` with `"user"`.
- Resolve: session Map → user file → env → default.
- `set` without scope → session (current behavior).
- Persist user via explicit flag or menu choice, e.g. `/ops-config set --user <key> <value>` and `/ops-config unset --user <key>`; `/ops-config reset` clears session only; `/ops-config reset --user` (or menu “Clear user preferences”) clears user keys with confirm if any exist.
- **Rationale:** session stays safe temporary override; user is deliberate.

### 3. Empty command = menu; args = direct

| Command | No args + hasUI | No args + !hasUI | With args |
|---------|-----------------|------------------|-----------|
| `/ops-config` | interactive menu | text catalog of actions/keys + current effective lines | existing show/get/set/unset/reset (+ user variants) |
| `/ops-metrics` | interactive menu | text catalog; may still show status summary | existing status/on/off/report/export/reset/db… |

- **Rationale:** matches `/ops-next`; **BREAKING** only for bare interactive default (was show/status).
- Power users and skills keep DSL.

### 4. Menu trees (implementation guide)

**Config root:** Show all · Edit a setting… · Clear session overrides · Clear user preferences… · Cancel  

**Edit:** pick known key (label includes effective value + source) → pick/enter value → **Save where?** Session only · User default · Cancel  

**Metrics root:** Status · Enable · Disable · Report… · Export… · Database… · Reset JSONL… · Cancel  

**Report…:** JSONL · SQLite → optional All changes · One change (`ui.input`)  

**Database…:** Status · Init default · Init custom path (`ui.input`) · Sync · Rebuild… · Detach · Destroy…  

Destructive (reset JSONL, rebuild, destroy, clear user): `ui.confirm` then execute same core functions as CLI path.

### 5. Policy vs CLI flags

- User/session `finish.return-to-main=required` only affects **Pi injection** and skill/deliver behavior (pass `--return-to-main`).
- CLI flag defaults remain off; no silent finish mutation from user file.
- **Rationale:** preserve shell predictability and finish-closeout safety contract.

### 6. Shared menu helpers

- Small pure helpers in extension module or `src/pi-config`/`src/ops-runtime` as appropriate: label lists, parse selection ids, text fallback formatter.
- Prefer reusing patterns from `ops-next` (`hasUI`, `ui.select`, cancel → notify stop).
- Avoid full `ui.custom` wizards in v1.

### 7. Specs split

- New `ops-admin-menus` for shared empty-command menu contract.
- Delta `ops-config` for user store + precedence + session-only requirement retirement.
- Delta `ops-lifecycle-metrics` for empty menu + UI confirm without rewriting collection semantics.

## Risks / Trade-offs

- **[Risk] Accidental permanent `required`** → Mitigation: Save-where defaults emphasize session first; user save is a second step; optional confirm when writing `finish.return-to-main=required` to user store.
- **[Risk] Bare-command behavior change surprises** → Mitigation: document BREAKING; keep explicit `show`/`status`; no-UI path stays non-blocking text.
- **[Risk] Menu depth / lost in submenus** → Mitigation: max two levels under metrics (root + Database/Report).
- **[Risk] File corruption / partial writes** → Mitigation: validate known keys on read; ignore invalid entries; write whole JSON atomically where practical (`writeFileSync` replace).
- **[Trade-off] English-only menus** → Accept for v1 consistency with admin notifies.
- **[Trade-off] CLI ignores user store** → Operators using only shell must still pass flags or set env; document clearly.

## Migration Plan

1. Ship extension + store; existing sessions unchanged until user sets preferences.
2. No data migration; empty user file = no user layer.
3. Docs/README: precedence table, menu entry, `--user` examples.
4. Rollback: remove user file or `reset --user`; code rollback leaves orphan `config.json` harmlessly unread.

## Open Questions

- Exact CLI spelling: `set --user` vs `prefer` subcommand — **prefer `set --user` / `unset --user` / `reset --user`** unless implementation finds parsing awkward.
- Whether writing user `finish.return-to-main=required` requires an extra confirm — **recommended yes** in menu path; optional for direct `--user` set.
