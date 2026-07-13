# Design: ops-deliver-register-command

## Pattern (mirror ops-next)

```ts
pi.registerCommand("ops-deliver", {
  description: "Batch start→finish after explore (reviews required; merge on invoke)",
  handler: async (args, ctx) => {
    let change = firstKebab(args);
    const rest = /* args after first token, trimmed */;
    if (!change) {
      // same candidate pick as ops-next (0/1/N)
    }
    const msg = [
      `Run the ops-deliver skill for change \`${change}\` only.`,
      `REQUIRED: change name is \`${change}\` (kebab-case). Do not claim the name is missing.`,
      rest ? `Optional objective: ${rest}` : "",
      `Follow .pi/skills/ops-deliver/SKILL.md pipeline until done or hard stop.`,
    ].filter(Boolean).join("\n");
    pi.sendUserMessage(msg, { deliverAs: "followUp" });
    ctx.ui.notify(`ops-deliver scheduled for ${change}`, "info");
  },
});
```

## Why followUp skill (not loop in extension)

Deliver needs multi-step LLM skills (propose/apply/reviews). Extension only **binds args** and kicks the skill—same split as auto-review used to do, but explicit.

## Args parsing

- `firstKebab(args)` for change
- Remainder of `args` after first whitespace-separated token = optional objective (may include quotes—v1: raw rest string)

## Missing name

Align with ops-next:

| Candidates | Behavior |
|---|---|
| 0 | usage + hint start/propose |
| 1 | use it |
| N | ui.select or text list |

## Tests

Extension handlers are hard to unit-test without Pi; prefer:

- pure `parseDeliverArgs(args: string): { change, rest }` helper if extracted
- or document manual check; optional small pure parse test

v1: extract `parseSlashChangeAndRest(args)` next to firstKebab for testability.

## Skill tweak

In ops-deliver SKILL steps:

1. Prefer change name from message lines `change name is \`...\`` / `change=\`...\`` if present  
2. Else parse from user `/ops-deliver <name>`  
3. Else fail  
