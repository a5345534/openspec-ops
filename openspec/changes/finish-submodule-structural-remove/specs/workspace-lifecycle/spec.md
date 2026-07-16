## MODIFIED Requirements

### Requirement: Finish teardown accounts for submodules before worktree remove
The finish command’s worktree removal path SHALL unload initialized top-level submodules before invoking ordinary `git worktree remove`. If ordinary removal then fails solely because the verified-clean worktree structurally contains a submodule gitlink, finish SHALL use a controlled internal structural-force removal without requiring operator discard consent. Dirty parent or submodule data MUST remain protected by the public `--force` gate.

#### Scenario: finish does not rely on manual force for clean happy path
- **WHEN** a clean change worktree contains an initialized or deinitialized top-level submodule gitlink
- **AND** finish is run without prior manual deinit and without operator `--force`
- **THEN** finish completes worktree removal on the happy path

#### Scenario: structural force is not dirty-discard consent
- **WHEN** clean finish requires Git's force mechanism only because of submodule containment
- **THEN** the operation may use internal structural force
- **AND** the result does not report that dirty content was forcibly discarded

#### Scenario: dirty monorepo remains protected
- **WHEN** the parent worktree or an initialized submodule is dirty
- **AND** the operator did not pass `--force`
- **THEN** finish fails before any forced worktree removal
