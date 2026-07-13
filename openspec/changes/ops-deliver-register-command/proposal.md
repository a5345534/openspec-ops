# Change: ops-deliver-register-command

## Why

`/ops-deliver <change>` is skill-only today. Unlike `/ops-next`, it is **not** registered on the Pi extension, so slash arguments are not programmatically bound. Agents often fail step 1 (“parse change name”) and stop with “Deliver 需要 kebab-case change 名稱” even when the user typed a valid name (e.g. `eve-via-litellm-gateway`).

## What Changes

- Register `pi.registerCommand("ops-deliver", …)` on `openspec-ops-guided.ts` (same pattern as `ops-next` / `ops-start`).
- Parse kebab change from command `args` via existing `firstKebab` / `CHANGE_NAME_RE`.
- If missing name: optional pick among candidates (reuse `listCandidateChanges`) **or** clear usage notify—prefer pick when candidates exist (align with ops-next UX).
- On success: `sendUserMessage` a **follow-up** that runs the ops-deliver skill with an unambiguous change binding, e.g.  
  `REQUIRED: /ops-deliver for change <name> only. Parse change=<name> from this message. …`  
  plus optional remainder of args as objective text.
- Update ops-deliver skill: name may arrive from extension-injected follow-up; still require kebab before pipeline.
- Docs one-liner: slash args are handled by the extension command.

## Capabilities

### Modified Capabilities

- `ops-deliver`: extension command registration binds change name before skill orchestration
- `pi-ops-skills`: document registerCommand / slash args for deliver

## Impact

- Extension + skill/prompt text only
- Fixes false “missing change name” when user passes args on the slash line

## Non-goals

- Reimplementing the full deliver loop inside the extension (stay skill-orchestrated)
- Changing pipeline order, merge consent, or mandatory reviews
