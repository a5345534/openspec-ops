## MODIFIED Requirements

### Requirement: Candidate discovery covers worktrees and active change dirs
Candidate discovery for nameless `/ops-next` SHALL include:

- Active `openspec/changes/<kebab>/` directories under resolved roots (excluding `archive/`)
- Change worktree directories under a `.worktrees/` parent (kebab leaf names)

Candidate discovery MUST NOT treat the basename of a package root, primary checkout, or other non-`.worktrees` root path as a change name solely because that basename matches kebab-case (e.g. must not list `openspec-ops` merely because the package is installed at a path ending in `openspec-ops`).

#### Scenario: active change dir is a candidate
- **WHEN** `openspec/changes/add-x/` exists under a resolved root and is not only under archive
- **THEN** `add-x` appears in the candidate list for nameless `/ops-next`

#### Scenario: worktree leaf is a candidate
- **WHEN** `<root>/.worktrees/ship-y/` exists as a directory
- **THEN** `ship-y` appears in the candidate list

#### Scenario: package root basename is not a candidate
- **WHEN** a resolved root path ends with `/openspec-ops` and is not itself a `.worktrees/openspec-ops` worktree path
- **AND** no active change dir or `.worktrees/<change>` entry exists for other names
- **THEN** the candidate list does not include `openspec-ops` solely from that root basename

#### Scenario: cwd under .worktrees still discovers the change
- **WHEN** a resolved root is `.../.worktrees/add-x`
- **THEN** `add-x` is included as a candidate via worktree-leaf detection
