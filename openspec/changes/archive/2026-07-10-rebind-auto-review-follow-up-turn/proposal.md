## Why

Auto-review today injects a same-turn side instruction after successful worktree ensure on slash-propose. That does **not** guarantee a dedicated review turn: the agent may skip it, multi-step propose may not be finished yet, and review is incorrectly coupled to ensure success (skill-path or `AUTO_START=off` propose never arms review). Users want **a new agent turn that runs ops-review** after propose artifacts are ready—not a mechanical review CLI and not a soft “please remember” note.

## What Changes

- Rebind auto-review from same-turn `before_agent_start` inject (tied to ensure success) to a **sticky watch + settle check + follow-up user message** that starts a **new turn** running ops-review
- Arm review watch on strong `/opsx-propose <kebab-name>` when `OPENSPEC_OPS_AUTO_REVIEW` is not `off`, **independent of** auto-ensure *success* (still arm when ensure is skipped/off); **clear the watch if ensure hard-aborts propose** so no zombie watch remains
- At `agent_settled`, if watch is armed and artifacts look ready (v1: change dir has at least `proposal.md`), clear watch and `sendUserMessage` (or equivalent) with `/ops-review <change>` as **followUp** so Pi opens a new turn and expands the skill
- If not ready yet, keep the watch (multi-turn propose safe); if clearly nothing to review, clear without firing
- Remove reliance on ensure-success as the only arm path; keep `OPENSPEC_OPS_AUTO_REVIEW=on|off` (default `on`)
- Do **not** add `openspec-ops review` mechanical CLI; ops-review skill remains the review body; skill stays manual fallback when policy is off
- Document new semantics in README (and that same-turn inject is no longer the main path)
- **Behavior change** for users who relied on same-turn inject only: review becomes a separate follow-up turn after settle + readiness

## Capabilities

### New Capabilities
- `pi-auto-review-follow-up`: Pi harness gate that opens a new agent turn to run ops-review after propose artifacts are ready, without a mechanical review CLI and without coupling to worktree ensure

### Modified Capabilities
- _(none required; auto-review was never specified under `pi-auto-ensure-on-propose`—implementation lives in the shared extension file only)_

## Impact

- **Code**: `.pi/extensions/openspec-ops-auto-ensure.ts` (review arm/settle/followUp); optional small pure helpers under `src/` for parse/ready checks + unit tests
- **Depends on**: Pi `sendUserMessage` / followUp delivery; existing `ops-review` skill/prompt; propose slash detection patterns (may share auto-ensure parse)
- **Does not change**: OpenSpec propose/apply/archive semantics; no new openspec-ops CLI subcommand for review
- **UX**: after propose settles with a proposal artifact, a follow-up turn runs `/ops-review <change>`; disable with `OPENSPEC_OPS_AUTO_REVIEW=off`
- **Risk**: followUp fires too early or twice—mitigate with sticky watch, readiness check, one-shot clear after fire
