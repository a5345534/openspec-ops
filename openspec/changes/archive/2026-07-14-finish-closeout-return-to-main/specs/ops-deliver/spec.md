## ADDED Requirements

### Requirement: Deliver documents return-to-main versus lifecycle success
The ops-deliver skill/prompt documentation SHALL state that completing the lifecycle through finish means stations through worktree closeout succeeded on the change, and that matching the operator mental model “primary on main and fully synced” may require an additional primary pull and submodule update unless opt-in finish sync flags were used.

Deliver MUST NOT treat primary lagging `origin/<base>` alone as a failed deliver when sync was not requested.

#### Scenario: deliver docs mention primary sync is separate
- **WHEN** reading ops-deliver instructions after this change
- **THEN** they distinguish lifecycle finish success from optional primary return-to-main sync
- **AND** they reference the recommended monorepo checklist or finish sync flags

---

### Requirement: Deliver does not enable primary sync by default
`/ops-deliver` MUST NOT pass `--sync-primary`, `--sync-submodules`, or `--attach-submodule-main` to finish by default. If the skill later supports operator opt-in for those flags, it SHALL only pass them when the operator or session config explicitly enables them.

#### Scenario: default deliver finish has no sync flags
- **WHEN** deliver runs finish on the default path without operator sync opt-in
- **THEN** finish is invoked without requiring sync-primary, sync-submodules, or attach-submodule-main
