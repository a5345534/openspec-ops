## ADDED Requirements

### Requirement: Ship respects detached-dirty submodule preflight
When ship runs against a change worktree, it SHALL use top-level submodule probe results and MUST abort if any top-level submodule is detached and dirty, consistent with not committing ambiguous parent state.

#### Scenario: ship aborts on detached dirty submodule
- **WHEN** ship is invoked
- **AND** a top-level submodule under the worktree is detached and dirty
- **THEN** ship does not complete a successful parent commit+PR for that invocation
