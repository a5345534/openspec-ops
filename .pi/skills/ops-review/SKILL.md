---
name: ops-review
description: Review an OpenSpec change's artifacts for consistency, completeness, and actionability before implementation. Use after propose, before apply.
license: MIT
metadata:
  author: openspec-ops
  version: "0.1.0"
---

# ops-review

Review an OpenSpec change's artifacts before implementation.

This skill reads the change's artifacts (proposal.md, design.md, specs/, tasks.md),
analyzes them across four dimensions, and presents concise findings with questions
for the reviewer. It does **not** modify artifacts — review is conversational.

**Relationship to OpenSpec:** This is an **optional** quality gate that runs
**after** `/opsx-propose` and **before** `/opsx-apply`. It does not replace or
modify OpenSpec's propose/apply/archive flow.

**Input:** Change name (kebab-case), e.g. `/ops-review add-auth`
**Provided arguments:** $@

---

## Resolve the change location

Find the change directory using openspec-ops, in order of preference:

1. **If inside a worktree:** check if `openspec/changes/<name>` exists locally
2. **Run `openspec-ops where <change> --json`** to locate the worktree
   - If exit 0: use `result.path` as base, look for `openspec/changes/<change>/`
   - If exit 5 (not found): fall back to `openspec status --change "<name>" --json`
3. **Run `openspec status --change "<name>" --json`** to get structured artifact paths:
   - `changeRoot`: the change directory
   - `artifactPaths`: paths to each artifact (proposal, design, specs, tasks)
   - Use these for reading files

If both fail: report "Change `<name>` not found" and stop.

---

## Read all artifacts

Read these files in order:

| Artifact | Typical path (relative to changeRoot) | Purpose |
|---|---|---|
| proposal.md | `proposal.md` | Why, What Changes, Capabilities, Impact |
| design.md | `design.md` | Context, Decisions, Risks |
| spec files | `specs/<capability>/spec.md` | Requirements, Scenarios |
| tasks.md | `tasks.md` | Implementation task list |

If any file is missing, note it as a finding (completeness issue).

---

## Analyze across four dimensions

### D1. Summary (what's this about?)

Distill into 1-3 sentences:
- What capability is being added or modified?
- How many specs, how many tasks?
- Any obvious risk or complexity flag?

This is the TL;DR — not a finding, just orientation.

### D2. Consistency (cross-artifact alignment)

Check for mismatches **between** artifacts:

| Check | What to look for |
|---|---|
| proposal → specs | Every "New/Modified Capability" in proposal.md has a corresponding spec file under `specs/`? |
| specs → tasks | Do spec requirements/scenarios have task coverage? |
| orphans | Any task that doesn't map to a spec requirement? Any spec without a root in proposal? |
| design → specs | Are design decisions (especially D1, D2, D3) reflected in spec requirements? |
| scope boundaries | Do all artifacts respect the scope defined in proposal's "What Changes"? |

For each mismatch found, record: the two artifacts involved, what differs, and
why it matters.

### D3. Completeness (structural integrity)

Check each artifact for missing or underspecified sections:

| Artifact | What to check |
|---|---|
| proposal.md | Has Why / What Changes / Capabilities / Impact? |
| design.md | Has Context / Decisions / Risks? |
| spec.md (each) | Has Requirements + Scenarios? Are scenarios concrete (with WHEN/THEN patterns)? |
| tasks.md | Are tasks concrete enough to start? Dependencies identified? |

For each gap found, record: what's missing and why it matters for
implementation.

### D4. Actionability (ready to implement?)

Forward-looking checks:

- Are spec requirements unambiguous? Or could two implementers produce
  different results?
- Are edge cases mentioned, or only happy path?
- Is the scope boundary clear? Are there obvious "we'll do this later" items
  that might cause confusion?
- Can each task be started independently, or are there hidden dependencies?

---

## Present findings

**Keep it concise.** The user said "簡潔提問最重要" (concise questions matter most).

Structure your output like this:

```
## Review: <change>

**TL;DR:** <1-2 sentence summary>

**Verdict:** ✅ Ready for apply | 🔄 Minor issues | ❌ Needs rework

<If verdict is not ✅, list findings>

### Findings

1. **<short title>** — ⚠️/<severity>
   <1-2 sentence description with specific file references>
   *Why it matters:* <why it could cause problems during implementation>

2. ...

### Questions for you

1. <question about finding 1, if user input needed>
2. <question about finding 2, if user input needed>

---

Ready to address any of these? Or want to proceed to apply?
```

**Guidelines for conciseness:**
- **Max 5 findings total.** If you find more, prioritize the most impactful.
- **Max 3 questions.** Group related issues.
- Distinguish severity:
  - `❌` — will block implementation or produce wrong behavior
  - `⚠️` — could cause confusion or rework
  - `ℹ️` — nice-to-improve, not blocking
- If everything looks clean: `✅ Ready for apply` with no findings.

---

## Iterate with the user

After presenting findings, the user may:

| User says | What to do |
|---|---|
| "Looks good" | Conclude with "Ready for `/opsx-apply <change>`" |
| "Fix X" in an artifact | Edit the artifact file (the change IS the conversation), then re-check that dimension |
| "What about Y?" | Answer from the artifacts, or flag as a new finding |
| "Let's rethink X" | Suggest `/opsx-explore` or update proposal/design |
| "Skip it" | Conclude without changes |

After each iteration, re-present the verdict if findings changed.

---

## Conclude

End with a clear next-action:

| Verdict | Next action |
|---|---|
| ✅ Ready for apply | "Ready for `/opsx-apply <change>`" |
| 🔄 Minor issues resolved | "Issues addressed. Ready for `/opsx-apply <change>`" |
| 🔄 Minor issues remain | "Open issues remain — I'd suggest resolving before apply" |
| ❌ Needs rework | "Consider `/opsx-explore <change>` to rethink scope" |

---

## Guardrails

- **Do NOT modify artifacts** unless the user explicitly asks during iteration.
- **Do NOT create review artifacts** (no review.md, no review file).
  Review is conversational, not a persisted file.
- **Do NOT block apply.** The user can always skip review or ignore findings.
- **Do NOT call openspec CLI commands** that modify state (propose, apply,
  archive, sync). Only read-only: `openspec-ops where`, `openspec status`.
- **Do NOT re-implement propose.** If artifacts are missing, say so and
  suggest `/opsx-propose`.
- **Prefer conservative findings** over false positives. If you're not sure a
  gap is real, flag it as `ℹ️` with a question rather than `⚠️`.
- **Respect the worktree.** Prefer reading files from the worktree path when
  available (openspec-ops where tells you the path).
