## REMOVED Requirements

### Requirement: Harness gate without forking OpenSpec propose
**Reason:** Auto-ensure-on-propose harness gate is removed. Worktrees are created only via explicit start.

### Requirement: Detect propose intent with strong signals only
**Reason:** No propose-intent ensure arm.

### Requirement: Parse change name conservatively
**Reason:** No ensure arm to parse for.

### Requirement: Default policy on with off and ask options
**Reason:** `OPENSPEC_OPS_AUTO_START` and ensure policies are removed.

### Requirement: Ensure uses openspec-ops only
**Reason:** No automatic ensure path.

### Requirement: Ensure failure aborts propose continuation
**Reason:** No ensure pre-hook on propose.

### Requirement: Documentation of gate and disable switch
**Reason:** Auto-ensure gate docs removed with capability.

### Requirement: Post-ensure hard write-path constraint
**Reason:** Constraint was coupled to auto-ensure success path; write alignment remains only via explicit start + operator cwd, not auto-ensure.

## ADDED Requirements

### Requirement: Explicit ops-start remains the worktree path
Operators SHALL create change worktrees via `openspec-ops start` / `/ops-start` (or equivalent explicit CLI) when a worktree is desired. Propose MUST NOT depend on a hidden ensure pre-step.

#### Scenario: no hidden ensure on propose
- **WHEN** the operator runs propose without a prior start
- **THEN** the system does not silently create a worktree solely because propose began
