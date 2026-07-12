## Context

Decisions from explore:

| Topic | Choice |
|---|---|
| Name | `ops-spec-review` (not ops-review-spec) |
| Parallel multi-model | **Out** for this change |
| Loop | review → **direct edit** artifacts → re-review |
| Stop | major findings = 0, or max rounds |
| max rounds | default **3**, configurable |
| Config UX | **Pi `/ops-config`**, session store, **no config files** |
| Precedence | session > env (optional) > default |

Today: `.pi/skills/ops-review`, `.pi/prompts/ops-review.md`, `OPS_REVIEW_SLASH = "/ops-review"`, auto-review schedules that slash after propose when policy on.

## Goals / Non-Goals

**Goals:**
- Clear entrypoint for OpenSpec plan/spec quality (not code review).
- Iterative fix loop with direct artifact edits in the same agent session.
- Configurable max rounds via Pi session config command.
- Auto-review and docs use the new entrypoint.

**Non-Goals:**
- Multi-session / multi-model synthesis.
- Hard-blocking `/opsx-apply` in CLI.
- Mechanical `openspec-ops review` that replaces the skill body.
- Project-committed config files (`ops.toml`, etc.).
- Persisting config across Pi process restarts (session-only v1; document that).

## Decisions

### D1 — Skill behavior: iterative review-fix

```text
/ops-spec-review <change>   # optional: respect ops-config max-rounds

for round in 1..maxRounds:
  resolve change via where / openspec status (worktree alignment)
  read proposal, design, specs/**, tasks
  classify findings: major | minor
  if no major:
    emit verdict ready-for-apply + residual minors + rounds + fix summary
    stop
  apply minimal edits to artifacts addressing majors only
    - do not expand scope / add unrelated capabilities
    - do not implement product code (artifacts only)
  record fixes
if still major after maxRounds:
  verdict needs-human / blocked with remaining majors
```

**Major (examples):** missing spec for listed capability; requirement without scenario; tasks miss main path; contradicts non-goals; unimplementable SHALL.  
**Minor:** wording, ordering, optional polish — do not continue loop solely for minors.

### D2 — maxRounds resolution

```text
effective = session[spec-review.max-rounds]
         ?? env OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS  # REQUIRED fallback path in code
         ?? 3

validate: integer >= 1 and <= 10 (clamp or reject invalid set)
```

Skill text: prefer injected effective config; if missing, default 3.
Env is for non-Pi / CI; Pi users prefer `/ops-config set`.

### D3 — ops-config (Pi command, session store)

Register Pi command e.g. `ops-config` (slash `/ops-config`):

| Subcommand | Behavior |
|---|---|
| `show` / (no args) | List known keys with value + source (session\|env\|default) |
| `get <key>` | Print one value + source |
| `set <key> <value>` | Store in **process/session memory** |
| `unset <key>` | Drop session override |
| `reset` | Clear all session overrides |

**v1 keys:**

| Key | Type | Default |
|---|---|---|
| `spec-review.max-rounds` | int | 3 |

Optional later (same store, not required v1): `auto.start`, `auto.review`, `auto.finish` — only if cheap; otherwise document future.

**No files written under the repo for config.**

Implementation sketch: module-level `Map` in extension (or `src/pi-config/store.ts` imported by extension). `getEffective(key)` implements precedence.

**Injection:** on `before_agent_start` (or when config changes), if any session keys set or always lightly, inject a short system/custom message:

```text
openspec-ops config (session): spec-review.max-rounds=5 (source=session)
```

so skills see it without reading extension memory.

### D4 — Replace ops-review (delete, no redirect)

- Add `ops-spec-review` skill + prompt (full operational text, iterative loop).
- **Delete** `.pi/skills/ops-review/` and `.pi/prompts/ops-review.md` entirely (no redirect stub).
- `src/auto-review/ready.ts`: `OPS_REVIEW_SLASH = "/ops-spec-review"` (constant may be renamed for clarity).
- Extension comments + follow-up message use new slash.
- Grep docs/tests for `/ops-review` and update.

### D5 — Auto-review interaction (full loop)

When auto-review fires follow-up, schedule `/ops-spec-review <change>` so the **same full iterative review-fix loop** runs (including direct artifact edits)—**not** a read-only one-shot.  
Document that `OPENSPEC_OPS_AUTO_REVIEW=on` may incur multi-round agent work; users can set `off` to skip.  
Policy env `OPENSPEC_OPS_AUTO_REVIEW` on/off semantics otherwise unchanged.  
Session config does not replace auto-review on/off in v1 unless we add keys later.

### D6 — Scope of edits

Allowed paths: under change root only (`proposal.md`, `design.md`, `specs/**`, `tasks.md`, `.openspec.yaml` if needed).  
Forbidden: product `src/` implementation, unrelated changes, expanding proposal scope to “fix” review by adding new product goals.

### D7 — Package surface

- New: `.pi/skills/ops-spec-review/`, `.pi/prompts/ops-spec-review.md`
- Redirect: ops-review
- Config: extension `registerCommand("ops-config", …)` — not necessarily a skill file; optional thin skill pointing at command
- Globs `ops-*` already cover new skill/prompt

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Infinite or thrashing edits | maxRounds + major-only loop + no scope expand |
| Agent over-edits | Explicit “minimal fix” + change-root only |
| Session config lost on restart | Document; show source=default |
| Auto-review now more expensive (multi-round full fix loop) | Document; AUTO_REVIEW=off; maxRounds caps |
| Confusion with code review | Naming + skill description |

## Open Questions (resolved)

| Q | Decision |
|---|---|
| Multi-model | No |
| Direct edit | Yes |
| max rounds | 3 default, configurable via ops-config |
| Config files | No |
| Hard apply gate | No |
| Auto-review body | Full review-fix loop (not read-only) |
| Legacy ops-review | **Delete** (no redirect) |
| Env max-rounds | **Implement** `OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS` |

## Implementation sketch

```text
src/pi-config/store.ts          # session map + getEffective
.pi/extensions/...auto-ensure   # registerCommand ops-config; inject; slash constant via import
src/auto-review/ready.ts        # OPS_REVIEW_SLASH
.pi/skills/ops-spec-review/
.pi/prompts/ops-spec-review.md
.pi/skills/ops-review/          # redirect
.pi/prompts/ops-review.md       # redirect
README + specs deltas
tests: store precedence + slash constant
```
