---
description: Review an OpenSpec change's artifacts before implementation (consistency, completeness, actionability)
---

# ops-review

Review an OpenSpec change's artifacts before implementation.

This reads the change's proposal, design, specs, and tasks, then presents
concise findings with questions. It does **not** modify artifacts.

**Input:** Change name (kebab-case), e.g. `/ops-review add-auth`
**Provided arguments:** $@

**Detailed skill:** `.pi/skills/ops-review/SKILL.md`

## Quick reference

1. **Resolve change** — `openspec-ops where <change> --json` or `openspec status --change "<name>" --json`
2. **Read artifacts** — proposal.md, design.md, specs/*/spec.md, tasks.md
3. **Analyze** — Summary, Consistency, Completeness, Actionability
4. **Present findings** — concise, max 5 findings, max 3 questions
5. **Iterate** — user responds, update artifacts if asked
6. **Conclude** — verdict + next action

**Guardrails:**
- Read-only unless user asks for edits
- No new artifact files (review is conversational)
- Don't block apply — user always decides
- Prefer concise over exhaustive
