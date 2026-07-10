## Context

The shared Pi extension (`.pi/extensions/openspec-ops-auto-ensure.ts`) currently:

1. Auto-ensures worktree on `/opsx-propose` (spec: `pi-auto-ensure-on-propose`)
2. Optionally sets `pendingReviewChange` **only after ensure success**
3. Injects same-turn `before_agent_start` text asking the agent to run ops-review

Exploration concluded:

- Users want **a guaranteed new turn** for LLM ops-review, not mechanical CLI lint
- Same-turn inject is a request, not a schedule
- Arm must **decouple from ensure**
- Readiness should be **artifact state**, analogous to finish’s orphan check (but executor is followUp skill turn, not CLI)

Pi APIs:

- `pi.on("input")` / `agent_settled`
- `pi.sendUserMessage(content, { deliverAs: "followUp" })` → new turn when agent is idle after current run

## Goals / Non-Goals

**Goals:**

- After slash-propose with a parseable name, arm a sticky review watch when policy is on
- On settle, if artifacts ready → one-shot followUp that starts ops-review for that change
- Decouple from ensure success/failure/skip
- Keep ops-review skill as the review implementation
- Policy `OPENSPEC_OPS_AUTO_REVIEW=on|off`, default `on`
- Fail-open for propose (never block propose because review arm failed)

**Non-Goals:**

- `openspec-ops review` mechanical CLI
- Blocking apply until review completes
- Free-form chat “propose” detection
- Infer change name when `/opsx-propose` has no args (v1 strict)
- Replacing ops-review skill content/dimensions
- Forcing review when user only ran ensure without propose

## Decisions

### D1. New turn via followUp user message, not same-turn inject

Primary mechanism:

```text
pi.sendUserMessage("/ops-review <change>", { deliverAs: "followUp" })
```

(or `/skill:ops-review <change>` if slash prompt name differs in env—prefer the project prompt/skill that expands ops-review)

Rationale: expands skill/prompt path and always triggers a turn; higher compliance than before_agent_start side note.

**Remove or demote** same-turn review inject as main path (may delete review lines from `before_agent_start` entirely to avoid double review).

**Alternative rejected:** mechanical CLI findings only — user explicitly wants LLM review turn.

### D2. Arm independent of ensure

```text
input: /opsx-propose <kebab>
  AUTO_REVIEW off? → no review arm
  parse name? → reviewWatches.add(change)
  ensure runs separately per AUTO_START (unchanged contract)
  always continue propose input (review never handles/cancels propose)
```

Ensure failure still aborts propose per existing ensure rules.

**When ensure aborts propose** (`handled` / hard failure / missing bin that blocks propose): the extension MUST **`reviewWatches.delete(change)`** for that change so a zombie watch does not linger. Review arm remains independent of ensure *success*, but must not outlive an aborted propose path.

If propose continues without artifacts yet, settle may find no `proposal.md` → keep watch until ready or policy off.

### D3. Sticky watch + artifact readiness

```text
agent_settled:
  for change in reviewWatches:
    if !artifactsReady(change): keep watch
    else: clear watch; sendUserMessage followUp /ops-review change
```

**v1 readiness (normative):**

- Resolve change directory candidates (primary and/or active workspace path if known):  
  `openspec/changes/<change>/proposal.md` exists

Optional strengtheners (non-required): design/tasks present; prefer not requiring full apply-ready so partial propose still gets early review if proposal exists—**v1 stays proposal.md only** for simplicity.

If change dir never appears after N settles, clear watch to avoid infinite keep (v1: clear after fire or when policy off; optional max settle count = 10 or clear when a different propose arms—document simple rule: **clear if proposal missing and ensure/active path shows changeDirExists false after at least one settle where we looked**—simpler v1: **keep until proposal.md exists OR user policy off OR new arm replaces**; avoid complex TTL unless easy).

**v1 clear rules:**

| Event | Watch |
|---|---|
| Arm | add |
| Settle + !ready | keep |
| Settle + ready | clear, then followUp |
| Ensure aborts propose for that change | **clear** (no followUp) |
| Policy off | clear all, no fire |
| FollowUp send attempted | clear (one-shot even if send throws—log/notify) |

### D4. Strong slash only for arm

Same spirit as ensure/finish:

- `/opsx-propose`, `/opsx:propose`
- First arg kebab-case name required
- No skill-name detection in v1 (document limit; skill-path propose still won’t arm—honest tradeoff unless cheap to add later)

### D5. Double-fire prevention

- Clear watch **before** or **immediately when** scheduling followUp
- Do not also leave `pendingReviewChange` same-turn inject
- Ignore `event.source === "extension"` for arm (followUp may appear as user message—must not re-detect as propose if text is `/ops-review`)

### D6. Layout

```text
src/auto-review/
  policy.ts      # parseAutoReviewPolicy on|off default on
  parse.ts       # re-export or thin wrap propose intent/name if needed
  ready.ts       # artifactsReady(change, roots) → boolean
.pi/extensions/openspec-ops-auto-ensure.ts
  # wire reviewWatches + settled followUp; strip old pendingReview inject
```

Unit-test policy + ready without Pi.

### D7. Relationship to other gates

```text
ensure:  constructive, may abort propose
review:  never aborts propose; only followUp after settle
finish:  orphan reclaim via CLI
```

Shared extension file OK for v1; naming still `openspec-ops-auto-ensure.ts` (rename out of scope).

## Risks / Trade-offs

- **[Risk] FollowUp during multi-turn propose after first proposal.md write** → early review; user can ignore findings; acceptable v1  
- **[Risk] sendUserMessage unavailable / non-interactive** → notify skip; no crash  
- **[Risk] Double review if inject left in place** → delete same-turn review inject  
- **[Risk] Slash-only misses skill propose** → documented; same as other gates  
- **[Trade-off] proposal.md-only readiness** → may review before design/tasks exist; ops-review already handles missing files as findings  

## Migration Plan

1. Add pure helpers + tests  
2. Rewire extension: arm on propose name; settle followUp; remove ensure-coupled pendingReview inject  
3. README  
4. Smoke: propose with name → settle with proposal → new turn `/ops-review`; ensure fail/skip still arms if propose continued… (if ensure aborts propose, no artifacts → no fire)  
5. Rollback: `OPENSPEC_OPS_AUTO_REVIEW=off`  

## Open Questions

- _(none for v1)_  

## Spike notes

- Prefer `deliverAs: "followUp"` so propose tools finish first  
- `triggerTurn` not required when using `sendUserMessage` (always triggers when not streaming; followUp waits for settle)  
- Never implement review logic in the extension beyond readiness + message fire  

### Spike 1.1 (ops-review entrypoint)

Project ships `.pi/prompts/ops-review.md` → slash command **`/ops-review`**.  
Follow-up message is exactly `/ops-review <change>` (`buildOpsReviewFollowUpMessage`).  
`/skill:ops-review` is not required for this repo’s prompt registration.  
