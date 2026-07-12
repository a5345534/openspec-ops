## ADDED Requirements

### Requirement: merge is a lifecycle CLI command
The openspec-ops CLI SHALL expose `merge` alongside other lifecycle commands in help text, accepting a change name and optional method/branch/repo flags.

#### Scenario: help lists merge
- **WHEN** a user runs `openspec-ops --help`
- **THEN** usage includes a `merge` command summary
