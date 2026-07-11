## Context

openspec-ops creates per-change git worktrees. Submodule checkouts in those worktrees typically follow the parent’s gitlink SHA and land on **detached HEAD**. Path alignment (ensure, REQUIRED inject, snippets) correctly steers file writes into the worktree—including submodule paths—without teaching agents that **parent branch ≠ submodule branch**.

Issue: https://github.com/a5345534/openspec-ops/issues/2

Today:
- `isDirty(worktree)` already reflects many submodule dirty cases via parent `git status`.
- `finish` refuses dirty trees (good) but messages do not name submodules.
- No doctor issue / where field for detached submodule HEAD.

## Goals / Non-Goals

**Goals:**
- Make **detached** top-level submodules under a change worktree **visible** via doctor **and** `where` JSON; elevate when also dirty.
- Document the correct manual loop: branch in submodule → commit → parent updates gitlink → then ship/finish.
- Keep behavior **fail-open** and **zero-cost** when no `.gitmodules` / no submodules.
- Preserve finish semantics: still block on dirty; never auto `--force`; never auto-commit; **shall** improve dirty refuse messaging.

**Non-Goals:**
- Auto `git switch -c` inside submodules at `start` (Option C — follow-up, opt-in only).
- Recursive nested submodule graphs.
- Auto-commit, push, PR, or merge.
- Changing OpenSpec archive.
- Replacing submodules with subtrees.
- Full submodule status UI beyond structured probe + messages.

## Decisions

### D1 — v1 scope = Document + Observe (A + B), not auto-branch (C)

| Layer | v1 |
|---|---|
| Docs / skills / snippet | Required |
| Doctor issues | Required |
| Where JSON `submodules` field | **Required** (additive; `[]` or populated) |
| Doctor: attached + dirty only | **Out of scope** (finish dirty still applies) |
| `start --init-submodule-branches` | Out of scope |

Rationale: highest DX gain / lowest risk; matches product stance (sidecar, no silent git identity mutation).

### D2 — Scan depth: top-level only

Read worktree `.gitmodules` (if present) and probe each listed path once under the **change worktree root**. Do not recurse into submodule-of-submodule.

Rationale: covers AOS-shaped monorepos; bounds cost and failure modes.

### D3 — Probe model (read-only)

For each top-level submodule path that exists as a git directory:

```text
{ path, detached: boolean, dirty: boolean, branch: string | null, head: string | null }
```

- **detached**: HEAD is not a branch (git symbolic-ref fails or equivalent).
- **dirty**: porcelain status non-empty inside submodule.
- **branch**: current branch name if attached; else null.
- Failures to probe a single submodule → skip or mark unknown; **do not fail** start/where/doctor overall.
- **Missing submodule directory** (listed in `.gitmodules` but path not present / not checked out) → **skip** (omit from `submodules[]`, no doctor issue).

### D4 — Doctor issue ids and severity

| id | When | Severity |
|---|---|---|
| `submodule_detached` | top-level submodule on detached HEAD, **not** dirty | **info** |
| `submodule_detached_dirty` | detached **and** dirty | **warning** |

- Emit for linked change worktrees (same population doctor already walks under worktrees root).
- **Do not** emit a dedicated issue for “attached branch + dirty” in v1 (parent dirty / finish gate covers risk).
- Hint text: create branch in submodule (`git switch -c <change>`), commit there, then commit parent gitlink; never long-lived work on detached HEAD.

### D5 — Where JSON (required additive field)

On successful `where`, result **MUST** include:

```json
"submodules": [ { "path", "detached", "dirty", "branch", "head" } ]
```

Use `[]` when no top-level submodules or none could be listed. schemaVersion stays `1`. Older clients ignore unknown fields; new clients may rely on the key being present after this change.

### D6 — Finish messaging (required copy change)

If dirty refuse fires, message **SHALL** mention that dirtiness may include submodule changes and that force discards uncommitted work (including inside submodules). No new exit codes. No submodule-specific force policy.

### D7 — Ownership split

| Actor | Owns |
|---|---|
| openspec-ops | Detect, report, document |
| Agent / human | `switch -c`, commit submodule, update parent pointer, PR |

### D8 — Docs placement

- README short “Submodules” subsection under worktree loop / lifecycle.
- `docs/snippets/worktree-alignment-block.md` (or sibling) apply/start note when `.gitmodules` exists.
- ops-start skill: one bullet — if submodules present, do not implement long-lived on detached HEAD.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Probe cost on large monorepos | Top-level only; skip if no `.gitmodules` |
| False positives (intentional detached) | Severity info/warning only; never block start |
| Where JSON consumers ignore new field | Additive; document in README |
| Agents still ignore docs | Doctor + dirty finish text; future C opt-in |
| Nested submodules invisible | Explicit non-goal; document |

## Open Questions (resolved for v1)

| Q | Decision |
|---|---|
| Recursive scan? | No |
| Auto branch at start? | No (follow-up) |
| Fail start if detached? | No |
| Who commits? | Never openspec-ops |

## Implementation sketch

```text
src/submodules/probe.ts   # parse .gitmodules + status per path (injectable for unit tests)
doctor.ts                 # emit issues per linked worktree
where.ts                  # always attach submodules[] on success
finish.ts                 # richer dirty message
README + snippets + ops-start skill
tests: inject probe results; optional light fixture — avoid mandatory heavy nested repos
```
