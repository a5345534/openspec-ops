## MODIFIED Requirements

### Requirement: Apply path binding to worktree when change name known
When apply-intent is detected with a parseable kebab-case change name and worktree alignment is required (`openspec-ops` resolvable and a change worktree is in use or being established via **explicit** `openspec-ops start` / `/ops-start`—not via `OPENSPEC_OPS_AUTO_START`), the system SHALL resolve the workspace via where/start and provide an agent-visible **REQUIRED** constraint to use worktree path `W` for implementation and OpenSpec operations for that change.

The system MUST NOT claim process cwd was switched unless it was.
The system MUST NOT treat `OPENSPEC_OPS_AUTO_START` as a live policy switch.

#### Scenario: opsx-apply with name binds path when worktree available
- **WHEN** input begins with `/opsx-apply add-dark-mode`
- **AND** alignment is required under the explicit-start model
- **AND** where/start succeeds with path `W`
- **THEN** the agent receives a REQUIRED write/implement path constraint naming `W`
- **AND** stock apply is allowed to continue

#### Scenario: apply without name does not false-ensure
- **WHEN** input is `/opsx-apply` with no parseable change name
- **THEN** the system does not report a successful ensure for a concrete change
- **AND** may notify that worktree binding waits for a change name

## ADDED Requirements

### Requirement: No live AUTO_* env in loop documentation
Recommended loop documentation and loop-closure requirements MUST NOT present `OPENSPEC_OPS_AUTO_START`, `OPENSPEC_OPS_AUTO_REVIEW`, `OPENSPEC_OPS_AUTO_FINISH`, or `OPENSPEC_OPS_AUTO_IMPL_REVIEW` as active configuration for the default product.

#### Scenario: loop docs omit live AUTO env tables
- **WHEN** reading the recommended delivery loop after this change
- **THEN** it does not instruct operators to set OPENSPEC_OPS_AUTO_* to control ensure/review/finish/impl-review auto behavior
