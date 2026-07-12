## Context

Issue #4:

1. `/ops-spec-review` is documented pre-apply but not gated → runs full fix loop when residual active artifacts exist post-archive.
2. Archive on **worktree** moves `W/openspec/changes/<c>/` → archive under W; **primary** may still have active `openspec/changes/<c>/` → status still active.

Default product order: merge → archive on **mainline** → finish. Worktree-aligned writes make worktree archive common pre-merge.

## Goals / Non-Goals

**Goals:**
- Spec-review stops with clear **phase_mismatch** (or equivalent messaging) when change is archived-only or clearly past apply/ship when detectable.
- Doctor reports split-brain active vs archived locations with remediation.
- Docs warn against wrong-phase review and dual trees.
- Auto-review remains propose-only.

**Non-goals:**
- Perfect detection of “apply already done” without heuristics (v1: prioritize **archived** and **strong** post-ship signals).
- Automatically deleting primary active dirs.
- Blocking ops-impl-review phase in this change (can note only).
- OpenSpec core archive algorithm rewrite.

## Decisions

### D1 — Phase signals for ops-spec-review (v1)

Evaluate roots: worktree path (if where succeeds), primary path, and known archive globs.

| Signal | Action |
|---|---|
| Active change dir **missing** but archive dir exists for name (`openspec/changes/archive/*-<change>/` or dated prefix) | **Refuse**: phase archived |
| Active change dir exists **only** under archive path | **Refuse** |
| User passes explicit override (skill flag text e.g. `force` / “historical re-review”) | Allow full review |
| Otherwise active change with proposal present | Allow (pre-apply / mid-plan) |

**Soft post-apply heuristic (optional v1 if cheap):** tasks all `[x]` **and** no open “implementation incomplete” — **warn** and prefer stop unless override; do not require perfect ship detection.

Prefer **hard refuse** for archived; **warn+stop default** for “looks post-apply” if heuristic confidence medium.

### D2 — Skill contract (primary enforcement)

ops-spec-review skill MUST:

1. Resolve change roots via where/status  
2. Run phase check  
3. On mismatch: print clear message, **do not** enter fix rounds  
4. Document override phrase for intentional audit  

Optional small pure function in `src/` for unit tests (e.g. `detectSpecReviewPhase(roots, changeName)`), used by skill instructions (“if helper available”) or only documented algorithm in skill if no CLI export needed.

**v1 recommendation:** implement **testable helper** in `src/lifecycle/phase.ts` + skill steps that mirror it; no new CLI subcommand required unless free.

### D3 — Doctor issue

Stable id: **`change_location_mismatch`** only.

- Severity: warning  
- When: active `openspec/changes/<name>` on primary (or wt) **and** archive entry for same name exists under primary or any linked worktree  
- Hint: do not re-run ops-spec-review; merge PR / sync mainline archive; remove residual active if duplicate  

Types: extend `DoctorIssue` id union.

### D1b — Helper return (for tests / skill)

```ts
type SpecReviewPhase = "ok" | "archived" | "active_and_archived";
// ok → proceed; archived → refuse; active_and_archived → refuse or warn (v1: refuse fix loop, message split-brain)
```

### D4 — Where (optional)

Where JSON MAY add `archivePath` / `phase` later; v1 doctor is enough if timeboxed. Prefer doctor first.

### D5 — Docs / auto-review

- README: merge → archive on mainline; worktree archive + primary residual footgun  
- Confirm auto-review only arms on propose (regression: no archive arm for spec-review)

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| False refuse mid-plan | Only hard-block on archive signals; override for audit |
| Miss post-apply without archive | Soft warn heuristic optional; issue accepts |
| Dual-root scan cost | Limit to primary + known worktrees from doctor context |

## Open Questions (resolved)

| Q | Decision |
|---|---|
| Priority | Issue #4 after #3 |
| Auto delete residual | No |
| Hard gate | Archived = refuse; post-apply heuristic soft |

## Implementation sketch

```text
src/lifecycle/phase.ts          # detect archive / phase for change name
.pi/skills/ops-spec-review      # phase check first
src/commands/doctor.ts + types  # change_location_mismatch
README
tests/phase.test.ts
```
