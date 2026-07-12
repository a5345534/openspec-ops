## MODIFIED Requirements

### Requirement: Iterative review-fix-push loop until no major findings
ops-impl-review SHALL run an iterative loop bounded by a maximum number of **full review rounds**.

**Round definition:** One round consists of exactly one **full review** of the current implementation against the change plan (relevant specs and tasks), the current diff/PR context, and project tests when available. Optionally, if that review finds majors, the round continues with implementation fixes, commit and push to the change branch without force, and an **in-round verify** that those fixes and tests address the majors. In-round verify (including re-running tests after push) MUST NOT be counted or reported as a separate review round.

**Full review:** Each full review MUST evaluate current code and plan alignment as a whole. It MUST NOT limit its scope only to verifying that majors from a previous round were fixed (prior major lists MAY be additional checks, not a scope ceiling). Non-zero project test exit status during a full review or in-round verify SHALL be treated as a major finding.

**Loop:**

1. Perform a full review; classify major vs minor.
2. If zero majors: stop with readiness for human merge (residual minors allowed).
3. If majors remain and full-review rounds remain: fix implementation, push without force when dirty, in-round verify; then if full-review rounds still remain, begin another full review (step 1). Do not declare ready solely because tests passed after push / in-round verify.
4. If majors remain and no further full review can run (including last-round fixes without confirmatory full review): stop with needs-human.

Minor findings MUST NOT alone force another full review round. If unsure, treat as minor.

#### Scenario: stops when a full review finds zero majors
- **WHEN** a full review round finds zero major findings
- **THEN** the loop stops
- **AND** the outcome indicates readiness for human merge (subject to residual minors)

#### Scenario: test failure is major
- **WHEN** the project test command exits non-zero during a full review or in-round verify
- **THEN** that constitutes a major finding

#### Scenario: after fixes a further full review is required before ready
- **WHEN** a full review finds majors
- **AND** the agent fixes, pushes if needed, and in-round verify passes
- **AND** at least one full review round remains
- **THEN** the agent performs another full review round before declaring ready for human merge
- **AND** does not declare ready solely because in-round verify or post-push tests passed

#### Scenario: verify is not a separate round
- **WHEN** the agent fixes majors and re-runs tests within a round
- **THEN** that confirmation is in-round verify
- **AND** it is not labeled or counted as its own review round

#### Scenario: stops at max full review rounds with remaining majors
- **WHEN** major findings remain after the maximum number of full review rounds (or last-round fixes lack a confirmatory full review with zero majors)
- **THEN** the loop stops
- **AND** the outcome reports needs-human with remaining majors or pending confirmatory full review
