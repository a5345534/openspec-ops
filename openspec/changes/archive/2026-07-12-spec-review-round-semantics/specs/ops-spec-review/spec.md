## MODIFIED Requirements

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
