## MODIFIED Requirements

### Requirement: Checks are a hard gate before merge
Before merging, the system SHALL verify PR checks status via gh.

If one or more checks are reported and any are not successful (failed, pending, or other non-success aggregate state as reported by gh), merge MUST abort and MUST NOT merge the PR.

If **zero** checks are reported for the PR (no CI configured / “no checks reported”), merge MUST allow by default. Operators MAY set `OPENSPEC_OPS_MERGE_EMPTY_CHECKS=refuse` (or `strict` / `fail` / `off`) to fail closed on empty checks.

If checks status cannot be determined for a reason other than empty checks (gh missing, unexpected query failure, non-empty indeterminate error), merge MUST fail closed and MUST NOT merge.

#### Scenario: failing or pending checks block merge
- **WHEN** PR checks are not all successful according to gh (and at least one check is reported)
- **AND** the user runs merge
- **THEN** the command fails with a stable `checks_failed` (or equivalent) error
- **AND** the PR is not merged

#### Scenario: empty checks allow merge by default
- **WHEN** gh reports no status checks for the PR
- **AND** `OPENSPEC_OPS_MERGE_EMPTY_CHECKS` is unset or `allow`
- **AND** the user runs merge
- **THEN** the empty-checks state does not by itself block merge
- **AND** merge may proceed (subject to other gates)

#### Scenario: empty checks refuse when configured
- **WHEN** gh reports no status checks for the PR
- **AND** `OPENSPEC_OPS_MERGE_EMPTY_CHECKS` is `refuse` (or `strict` / `fail` / `off`)
- **AND** the user runs merge
- **THEN** the command fails with `checks_failed`
- **AND** the PR is not merged

#### Scenario: cannot evaluate checks blocks merge
- **WHEN** gh cannot provide a successful checks evaluation for a reason other than empty checks
- **AND** the user runs merge
- **THEN** the command fails without merging
