# ops-spec-review Specification

## Purpose

Iterative OpenSpec plan/spec quality gate: review artifacts, fix major findings, re-review until clean or max rounds.

## Requirements

### Requirement: ops-spec-review is the plan/spec quality gate before apply
The project SHALL provide a Pi skill and matching slash entrypoint `ops-spec-review` / `/ops-spec-review` that reviews OpenSpec change artifacts (proposal, design, specs, tasks) for a named change after propose and before apply.

The skill MUST describe itself as an OpenSpec plan/spec quality gate and MUST NOT present itself as application code review or PR review.

#### Scenario: skill names spec review purpose
- **WHEN** reading the ops-spec-review skill
- **THEN** it states that it reviews OpenSpec planning artifacts and is used before apply

---

### Requirement: Iterative review-fix loop until no major findings
ops-spec-review SHALL run an iterative loop bounded by a maximum number of **full review rounds**.

**Round definition:** One round consists of exactly one **full review** of the current change artifacts (proposal, design, specs, tasks as present), optionally followed by fixes for majors found in that review and an **in-round verify** that those fixes are reflected in the artifacts. In-round verify MUST NOT be counted or reported as a separate review round.

**Full review:** Each full review MUST evaluate the current artifacts against the major/minor criteria as a whole. It MUST NOT limit its scope to only verifying that majors from a previous round were fixed (prior major lists MAY be used as additional checks, not as a ceiling on scope).

**Loop:**

1. Perform a full review; classify findings as major or minor.
2. If zero majors: stop with readiness for apply (residual minors allowed).
3. If majors remain and rounds remain: edit change artifacts to address those majors, then in-round verify the fixes; then if rounds still remain, begin another full review round (step 1). Do not treat in-round verify alone as sufficient for readiness after fixes.
4. If majors remain and no full review rounds remain (including the case where the last round fixed majors but no further full review can run): stop with needs-human and list remaining issues / pending confirmatory full review.

Minor findings alone MUST NOT force another full review round. If unsure whether a finding is major, treat it as minor.

#### Scenario: stops when a full review finds zero majors
- **WHEN** a full review round finds zero major findings
- **THEN** the loop stops without requiring another round
- **AND** the outcome indicates readiness for apply (subject to residual minors)

#### Scenario: after fixes a further full review is required before ready
- **WHEN** a full review finds majors
- **AND** the agent fixes those majors and in-round verify passes
- **AND** at least one full review round remains
- **THEN** the agent performs another full review round before declaring ready for apply
- **AND** does not declare ready solely because in-round verify passed

#### Scenario: verify is not a separate round
- **WHEN** the agent fixes majors within a round
- **THEN** confirmation of those fixes is done as in-round verify
- **AND** that confirmation is not labeled or counted as its own review round

#### Scenario: stops at max full review rounds with remaining majors
- **WHEN** major findings remain after the maximum number of full review rounds (or fixes on the last round still lack a confirmatory full review with zero majors)
- **THEN** the loop stops
- **AND** the outcome reports that human attention is needed with remaining majors or pending confirmatory review listed

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


---

### Requirement: Phase check before review-fix loop
ops-spec-review SHALL perform a lifecycle phase check before entering the iterative major-fix loop, and MUST skip the loop when the change is in an archived (or equivalent post-plan) phase without an explicit override.

#### Scenario: skill documents pre-apply phase and refuse behavior
- **WHEN** reading the ops-spec-review skill after this change
- **THEN** it states pre-apply timing and that archived/wrong-phase invocations should stop with a clear message
