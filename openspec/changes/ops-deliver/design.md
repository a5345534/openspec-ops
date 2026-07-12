# Design: ops-deliver

## Entry

```text
/ops-deliver <kebab-change> [optional free text for propose context]
```

**Prerequisites (human):** explore finished; change name chosen.  
**Consent:** running deliver authorizes: worktree create, commits via ship, **squash merge** when checks allow, archive, finish (no force).

## Orchestration model

**Skill-first:** Pi agent executes slash skills / CLI in order. Not a single Node process running LLM.

```text
loop:
  station = detectLifecycleStation(signals with PR)
  if station == done: success; stop
  if steps > MAX: needs_human; stop
  action = deliverDefaultAction(station)  # hard-coded subset of edges
  if action requires agent skill:
    run skill fully (propose/apply/spec-review/impl-review/archive)
    if review verdict needs_human: stop
  if action is CLI:
    openspec-ops start|ship|merge|finish --json
    on failure: stop
  continue  # resume-friendly
```

## deliverDefaultAction (v1)

| Station | Action |
|---|---|
| no_workspace | ops-start |
| ready_to_propose | opsx-propose |
| proposed | ops-spec-review **then** (if ready) opsx-apply — or: review until ready, next loop apply |
| applied | ops-ship |
| shipped | ops-impl-review **then** (if ready) ops-merge |
| merged | opsx-archive |
| archived | ops-finish |
| done | stop |
| unknown | stop + doctor hint |

**Reviews mandatory:** from `proposed`, never jump to apply without successful spec-review in this deliver run or already satisfied only if station advanced past review—station `proposed` always triggers spec-review first. From `shipped`, always impl-review before merge.

Implementation detail: after spec-review returns ready, either same turn apply or next loop iteration sees tasks/apply state—prefer **explicit sequence in skill**: while proposed-like, run review until ready, then apply once.

## Merge

- Call `openspec-ops merge <change> --json` without extra confirm.
- checks_failed → stop (no bypass).
- already_merged → treat as success for that step, continue.

## Finish

- Never pass `--force` unless future explicit flag (v1: no).
- dirty → stop with message.

## MAX steps

e.g. 20 station transitions to prevent infinite loops.

## Relation to ops-next

| | ops-next | ops-deliver |
|---|---|---|
| Consent | each step | whole remaining happy path |
| Reviews | optional choice | required |
| Merge | user picks | automatic when ready |

## Packaging

- `.pi/skills/ops-deliver/SKILL.md`
- `.pi/prompts/ops-deliver.md`
- `package.json` files entry
- README section

## Optional pure helper

`src/next-step/deliver.ts`: `defaultDeliverAction(station) → NextActionId | null` + unit tests. Skill documents the same table even if helper unused initially.
