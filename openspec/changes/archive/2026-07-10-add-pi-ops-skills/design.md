## Context

`openspec-ops` Phase 0 CLI (`start` / `where` / `finish` / `doctor`) is implemented with stable JSON (`schemaVersion: 1`) and exit codes. This repo already ships OpenSpec Pi assets under `.pi/skills/openspec-*` and `.pi/prompts/opsx-*`.

Exploration froze harness-facing skill design:

- Name prefix `ops-*` (not `opsx-*`) so workspace helpers never look like official OpenSpec commands
- Four discrete skills matching CLI 1:1
- Full shared runtime rules embedded in every skill (capability over DRY)
- Slash prompts are **full-text self-contained** (not short forwarders)
- Thin orchestration only: always `openspec-ops … --json`; never raw `git worktree`

## Goals / Non-Goals

**Goals:**

- Pi can manually trigger workspace lifecycle via skills and `/ops-*` prompts
- Agents interpret CLI JSON/exit codes consistently
- Preserve OpenSpec flow: propose/apply/archive remain separate
- Skill and prompt bodies carry equal operational capability

**Non-Goals:**

- Pi extension `registerCommand` / `registerTool` / lifecycle hooks
- Auto-start on `/opsx-propose` (no hijacking)
- Global install packaging beyond documenting optional symlink to `~/.pi/agent/skills`
- Changing `openspec-ops` CLI behavior
- `ops-loop` mega-skill that chains propose

## Decisions

### D1. Four skills + four prompts

| Asset | Role |
|---|---|
| `ops-start` | create/reuse workspace |
| `ops-where` | locate path / dirty |
| `ops-finish` | remove worktree (keep branch) |
| `ops-doctor` | read-only health |

**Why not one multi-action skill:** weaker description routing; poorer slash UX; harder confirmations on finish.

### D2. Full-text self-contained prompts and skills

- Each `SKILL.md` embeds complete Shared runtime rules + command steps
- Each `ops-*.md` prompt embeds the same operational content + `$@` input binding
- **Why:** slash path and description-triggered path both work offline without cross-reads
- **Trade-off:** dual maintenance → tasks require updating all eight files when contract text changes

### D3. Shared rules content (must not be shortened)

Every skill/prompt MUST include:

1. Binary resolve: `OPENSPEC_OPS_BIN` → `PATH` → stop with install hint  
2. Always `--json`; require `schemaVersion === 1`  
3. Full exit code table (0/1/2/3/4/5/10) and agent behavior  
4. Success/error envelope shapes  
5. Hard guardrails (no opsx replacement, no commit/PR, no unauthorized `--force`, no raw git worktree, prefer workspace cwd for follow-on work)

### D4. Command-specific behavior

**start**

- Confirm derived change names
- Pass optional `--branch`/`--path`/`--base`/`--repo` only if user asked
- `created` and `reused` are both success
- If user only wanted workspace: stop after report
- If user wanted to begin a change: MAY continue OpenSpec propose **in `result.path` cwd** as a separate step

**where**

- Read-only; `not_found` suggests start; does not auto-start

**finish**

- Recommended preflight `where`
- Soft-warn dirty and apparent active change dir; confirm before `--force`
- Never claim archive happened; never delete branch

**doctor**

- Summarize summary → issues → worktrees; no auto-fix

### D5. Fixed phrases

Include stable user-facing sentences (bin missing, created/reused, finish ok, etc.) in each document to reduce agent drift.

### D6. Layout

```text
.pi/skills/ops-start/SKILL.md
.pi/skills/ops-where/SKILL.md
.pi/skills/ops-finish/SKILL.md
.pi/skills/ops-doctor/SKILL.md
.pi/prompts/ops-start.md
.pi/prompts/ops-where.md
.pi/prompts/ops-finish.md
.pi/prompts/ops-doctor.md
```

Optional maintainer-only doc is allowed but MUST NOT be required at runtime.

### D7. Content source for implementation

Implement from the frozen explore drafts (shared rules + per-command steps + fixed phrases), aligned to CLI contract in `workspace-lifecycle` / Phase 0 behavior—not a new CLI dialect.

## Risks / Trade-offs

- **[Risk] Skill/prompt drift** → Mitigation: single change updates all eight; checklist in tasks; schemaVersion pin
- **[Risk] Agent still runs raw git worktree** → Mitigation: repeated hard guardrails; description steers to openspec-ops
- **[Risk] Confusion with opsx-*** → Mitigation: `ops-*` naming + explicit “not archive” on finish
- **[Risk] CLI not on PATH in Pi cwd** → Mitigation: `OPENSPEC_OPS_BIN` + install hints in every file
- **[Trade-off] Verbose duplicated markdown** → Accepted for capability and slash self-containment

## Migration Plan

1. Add the eight markdown files and README section
2. Reload Pi (`/reload` if needed) in this project
3. Smoke: `/ops-start` on a fixture or external repo, then where/doctor/finish
4. Rollback: delete the eight files; CLI remains usable from shell

## Open Questions

- Whether to later publish as a Pi package for global install — deferred
- Whether project-local `.pi/prompts/opsx-propose.md` should mention optional `/ops-start` — optional docs nicety, not required for this change
