## Context

openspec-ops today:

- CLI: start/where/finish/doctor
- Pi extension: slash ensure, review follow-up turn, finish orphan reclaim
- Gates arm primarily from `/opsx-propose <kebab>` / `/opsx-archive <kebab>`

Exploration + OpenSpec 1.5.0 audit:

- Slash `/opsx:*` is **chat instructions**, not a CLI event
- Stable machine API: `openspec … --json` (upstream agent-contract)
- `openspec new change <name>` is the **identity birth** moment (name in argv)
- Pre-exec intercept runs **before** `openspec/changes/<name>` exists
- Users do not supply kebab names on slash; agents do at `new change`

## Goals / Non-Goals

**Goals:**

- Pre-exec intercept of `openspec new change <kebab>` as primary ensure-before-scaffold signal
- Policy **`on`|`off` only in v1** (default `on` when using the intercept entrypoint)
- Forward to real OpenSpec unchanged (stdio/exit)
- Prefer worktree cwd for the `new change` child after successful start
- Extension settle-time **proposal discovery** for review without slash arm
- Opt-in install; do not hijack global `openspec` by default via package.json `bin`

**Non-Goals:**

- Policy `ask` in v1 (deferred)
- Patching `@fission-ai/openspec`
- Chat NLP for “propose”
- Guaranteeing all subsequent agent commands use worktree cwd
- Capturing mkdir-without-CLI in v1
- Intercepting `archive` and other subcommands in v1
- Shim writing into Pi in-process review watch sets

## Decisions

### D1. Primary mechanism = opt-in wrapper binary

Ship **`openspec-ops-intercept`** (name locked):

1. Resolve **real** openspec (D2)
2. If argv is `new change <kebab>` and policy `on`: ensure (D3)
3. Spawn real openspec with same argv; cwd per D4
4. Same exit code; do not rewrite JSON stdout

Not Pi-only: any agent that shells `openspec` benefits when intercept is what they invoke (alias/PATH).

### D2. Resolve real openspec without recursion

1. `OPENSPEC_REAL_BIN` if set and not this binary (realpath)
2. PATH walk skipping this binary’s realpath
3. Optional well-known npm global `@fission-ai/openspec/bin/openspec.js`
4. Else non-zero + install guidance

### D3. Ensure policy — `on` | `off` only (v1)

Env: `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE=on|off` (case-insensitive).  
**Default: `on`.** Unknown values → `on`.

| Policy | Behavior |
|---|---|
| `on` | `openspec-ops start <name> --json`; hard fail → **block** upstream `new change`; success → forward |
| `off` | Pure forward |

**`ask` is out of v1** (no TTY ambiguity).

Ops binary: `OPENSPEC_OPS_BIN` / PATH / package `bin/openspec-ops`.

### D4. Cwd for upstream `new change` + limitation

After successful start, child cwd = worktree `path` from start/where JSON.

**Limitation (documented):** only the intercept child uses that cwd. Later agent tools may still run in primary/session cwd.  
**Mitigation (v1):** on successful ensure, print one stderr line: worktree path + hint to cd for subsequent writes.  
**Non-goal:** rewriting the parent shell cwd.

### D5. Review = extension settle discovery (not shim arm)

- Shim **does not** arm Pi review watches (separate processes)
- Extension on `agent_settled`: if `AUTO_REVIEW=on`, find `openspec/changes/<name>/proposal.md` under resolved roots; one-shot followUp `/ops-review <name>` per session rules
- Works for agent-named changes created via intercept or plain openspec

### D6. argv parse

- Detect `new change` + kebab name among flags (`--json`, `--schema`, `--store`, `--description`, …)
- Invalid/missing name → no ensure, pure forward (upstream errors)

### D7. Install

- package.json `bin`: **`openspec-ops-intercept`** only (not `openspec`)
- README: `alias openspec=openspec-ops-intercept` or PATH order + `OPENSPEC_REAL_BIN`
- User opt-in

### D8. Slash ensure relationship

| Path | Role |
|---|---|
| Intercept + `new change` | **Primary** ensure-before-scaffold |
| Slash with kebab name | Optional early ensure |
| Slash without name | No ensure at input |

## Risks / Trade-offs

- **[Risk] Recursion** → realpath + OPENSPEC_REAL_BIN  
- **[Risk] Start fail blocks create under on** → message + INTERCEPT=off  
- **[Risk] Later writes on wrong cwd** → stderr hint; accept v1 limit  
- **[Trade-off] No ask** → simpler; re-add later if needed  
- **[Trade-off] mkdir bypass** → v1 accept  

## Migration Plan

1. Parse + real-bin + policy tests  
2. Ensure-then-forward + cwd + stderr hint  
3. Extension proposal discovery + one-shot  
4. README  
5. Smoke  

## Open Questions

- _(none for v1 — bin name and policy set)_  

## Spike notes

- Upstream has no public pre-create hook; wrapper is the extension point  
- Agent-contract JSON shapes consumed, not modified  
