## ADDED Requirements

### Requirement: prune is a workspace lifecycle command
The openspec-ops CLI SHALL expose `prune` as a first-class command that accepts a change name and optional remote/branch overrides, documented in CLI help.

#### Scenario: help lists prune
- **WHEN** a user runs `openspec-ops --help`
- **THEN** usage includes a `prune` command summary

### Requirement: finish remains non-deleting for branches by default
`finish` MUST continue to keep the change branch by default (`branchDeleted` false). Prune is the explicit path for branch deletion after merge.

#### Scenario: finish does not require branch delete
- **WHEN** finish succeeds without new flags that opt into deletion
- **THEN** the branch is retained as in prior lifecycle behavior
