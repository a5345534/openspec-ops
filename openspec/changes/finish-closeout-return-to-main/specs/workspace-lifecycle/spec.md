## ADDED Requirements

### Requirement: Doctor reports primary behind origin base
Doctor SHALL, when local remote-tracking data is available, detect whether the primary worktree tip is strictly behind `origin/<base>` (repository default base branch) and report a stable issue id `primary_behind_origin` at **warning** severity with a hint to `git pull --ff-only` (or fetch then pull) on primary.

Doctor MUST remain read-only (no fetch required for the check to run; missing remote-tracking refs MUST skip or omit this issue without failing the doctor command). Exit code remains `0` when only this class of issue is present.

#### Scenario: primary behind yields warning issue
- **WHEN** doctor runs
- **AND** primary HEAD is a strict ancestor of `origin/<base>` with a non-zero behind count
- **THEN** an issue with id `primary_behind_origin` and severity `warning` is present
- **AND** the process exits with code `0`

#### Scenario: missing remote-tracking does not fail doctor
- **WHEN** doctor runs
- **AND** `origin/<base>` cannot be resolved locally
- **THEN** doctor still completes successfully
- **AND** does not require emitting `primary_behind_origin` solely due to missing remote data

#### Scenario: primary up to date omits behind issue
- **WHEN** doctor runs
- **AND** primary tip equals `origin/<base>`
- **THEN** doctor does not report `primary_behind_origin`
