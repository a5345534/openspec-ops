## ADDED Requirements

### Requirement: ops-spec-review is the plan/spec quality gate before apply
The project SHALL provide a Pi skill and matching slash entrypoint `ops-spec-review` / `/ops-spec-review` that reviews OpenSpec change artifacts (proposal, design, specs, tasks) for a named change after propose and before apply.

The skill MUST describe itself as an OpenSpec plan/spec quality gate and MUST NOT present itself as application code review or PR review.

#### Scenario: skill names spec review purpose
- **WHEN** reading the ops-spec-review skill
- **THEN** it states that it reviews OpenSpec planning artifacts and is used before apply

---

### Requirement: Iterative review-fix loop until no major findings
When `/ops-spec-review` runs for a change, the agent SHALL iteratively:

1. Review artifacts and classify findings as major or minor
2. If any major findings exist and rounds remain, **edit** change artifacts to address those majors
3. Re-review

The loop MUST stop when there are no major findings, or when the configured maximum rounds is reached.

Minor findings MUST NOT alone force another round.

#### Scenario: stops when majors cleared
- **WHEN** a review round finds zero major findings
- **THEN** the loop stops
- **AND** the outcome indicates readiness for apply (subject to residual minors)

#### Scenario: stops at max rounds with remaining majors
- **WHEN** major findings remain after the maximum number of rounds
- **THEN** the loop stops
- **AND** the outcome reports that human attention is needed with remaining majors listed

---

### Requirement: Direct artifact edits only under the change root
During the fix phase, the agent SHALL apply edits only to the OpenSpec change artifacts for that change (e.g. proposal, design, specs, tasks under the change directory) and MUST NOT treat product implementation source trees as in-scope fixes for this skill.

Edits MUST aim to resolve major findings without expanding product scope beyond the change’s stated goals.

#### Scenario: fix phase does not require implementing product code
- **WHEN** ops-spec-review addresses a major finding
- **THEN** the prescribed fix is an artifact edit under the change root
- **AND** not an implementation change under application `src/` as part of this skill’s duty

---

### Requirement: Default max rounds is three and is configurable without project config files
The default maximum review-fix rounds SHALL be **3**.

The maximum MUST be overridable via Pi session configuration (ops-config) without requiring a project config file.

The implementation SHALL also honor environment variable `OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS` as a fallback when no session override is set (precedence: session > env > default). Env MUST NOT be the only configuration path documented for Pi users (`/ops-config` remains primary in Pi).

#### Scenario: default three rounds
- **WHEN** no session or env override is set
- **THEN** ops-spec-review uses a maximum of 3 rounds

#### Scenario: session override raises cap
- **WHEN** session config sets `spec-review.max-rounds` to `5`
- **THEN** ops-spec-review uses 5 as the maximum rounds for that session

#### Scenario: env fallback when session unset
- **WHEN** session has no override
- **AND** `OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS=4`
- **THEN** effective max rounds is 4

---

### Requirement: Worktree-aligned change resolution
ops-spec-review SHALL resolve the change directory using openspec-ops where/status patterns so artifacts are read and written under the change worktree when one exists.

#### Scenario: prefers worktree change path when where succeeds
- **WHEN** `openspec-ops where <change>` succeeds with path `W`
- **AND** `W/openspec/changes/<change>` exists
- **THEN** review and fixes use that change directory
