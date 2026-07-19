## ADDED Requirements

### Requirement: Composite return-to-main closeout is explicit and strict
`openspec-ops finish` SHALL accept `--return-to-main` as an explicit composite closeout request. It SHALL require a clean primary checkout, synchronize the primary base branch ff-only after lifecycle-created remote commits exist, update initialized submodules to superproject gitlinks, and safely attach eligible initialized submodules recursively to resolved remote default branches. It MUST NOT use hard reset, force branch replacement, force push, auto-commit, or discard local work.

#### Scenario: strict happy path
- **WHEN** finish runs with `--return-to-main`
- **AND** primary and all initialized submodules recursively are clean and compatible
- **THEN** primary ends on the resolved base branch at `origin/<base>`
- **AND** each reported submodule HEAD equals its superproject gitlink
- **AND** each eligible initialized submodule, including nested submodules, is attached to its resolved remote default branch
- **AND** the superproject remains clean

#### Scenario: default remains unchanged
- **WHEN** finish runs without `--return-to-main` and without existing sync flags
- **THEN** it does not mutate primary or primary submodule checkout state

### Requirement: Strict closeout resolves submodule remote defaults
The system SHALL recursively inventory initialized submodules and resolve each applicable submodule's remote default branch rather than assuming `main`. It SHALL fetch current remote metadata before evaluating compatibility. A missing or unavailable remote default SHALL be a non-success strict outcome.

#### Scenario: nested non-main remote default
- **WHEN** an initialized nested submodule remote HEAD resolves to `origin/master`
- **AND** `origin/master` is compatible with the parent gitlink
- **THEN** the submodule is attached to local branch `master` at the gitlink

#### Scenario: remote default unavailable
- **WHEN** a submodule remote default branch cannot be resolved
- **THEN** strict closeout fails with `return_to_main_needs_human`
- **AND** identifies that submodule with attach outcome `default_unresolved`

### Requirement: Submodule attachment preserves history and parent pins
The system SHALL attach a submodule only when its remote default tip equals the parent gitlink or is an ancestor that can fast-forward exactly to the gitlink. Existing local branches MUST NOT be replaced. If the remote default is ahead of or diverged from the gitlink, the system SHALL leave the checkout at the parent pin and fail strict closeout.

#### Scenario: default branch fast-forwards to gitlink
- **WHEN** the remote default tip is an ancestor of the parent gitlink
- **THEN** the local default branch may be created or fast-forwarded to exactly the gitlink
- **AND** no reset or force is used

#### Scenario: default branch ahead of gitlink
- **WHEN** the remote default branch contains commits beyond the parent gitlink
- **THEN** the system does not move the superproject gitlink or rewind the submodule branch
- **AND** fails with `return_to_main_needs_human`
- **AND** reports attach outcome `incompatible_default`

#### Scenario: dirty submodule fails closed
- **WHEN** an initialized submodule contains local changes during strict closeout
- **THEN** the system does not switch or update that submodule
- **AND** fails with structured diagnostics without discarding work

### Requirement: Return-to-main results expose final state
Successful finish JSON SHALL report the strict policy state, final primary branch and HEAD, and for each applicable initialized submodule recursively its path, branch, HEAD, gitlink, resolved remote default branch, and attach outcome. Strict failures SHALL expose the available snapshot and whether the change worktree was already removed in structured error details.

#### Scenario: successful structured result
- **WHEN** strict return-to-main succeeds
- **THEN** `result.sync.required` is true
- **AND** `result.sync.primary` identifies the final base branch and HEAD
- **AND** every `result.sync.submodules[]` row contains final branch, HEAD, gitlink, remote default branch, and attach outcome

#### Scenario: incompatible structured failure
- **WHEN** any required submodule cannot safely attach at its parent gitlink
- **THEN** the JSON error code is `return_to_main_needs_human`
- **AND** error details include per-submodule outcomes and `worktreeRemoved`
