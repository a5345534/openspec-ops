# workspace-lifecycle Specification

## Purpose

Git worktree/branch lifecycle for an OpenSpec change name via the `openspec-ops` CLI, without modifying OpenSpec semantics.

## Requirements

### Requirement: CLI binary and command surface
The system SHALL expose a command-line entrypoint named `openspec-ops` that supports exactly these Phase 0 subcommands: `start`, `where`, `finish`, and `doctor`.

The system SHALL accept global flags `--json`, `--repo <path>`, `--help`, and `--version` on the entrypoint.

The system MUST NOT require any AI harness, Orca, or the OpenSpec CLI to perform workspace operations.

#### Scenario: Help lists Phase 0 commands
- **WHEN** the user runs `openspec-ops --help`
- **THEN** the output identifies the `start`, `where`, `finish`, and `doctor` subcommands

#### Scenario: Unknown subcommand fails as usage error
- **WHEN** the user runs `openspec-ops nosuch`
- **THEN** the process exits with code `1`
- **AND** the error indicates invalid usage

---

### Requirement: Change name identity and defaults
The system SHALL treat the OpenSpec change name as the primary workspace key.

A change name MUST match `^[a-z0-9]+(?:-[a-z0-9]+)*$` or the command MUST exit with code `1` and error code `invalid_change_name`.

Unless overridden by flags, the system SHALL derive:

- `branch` = `<change>`
- `path` = `<primaryPath>/.worktrees/<change>`

The system SHALL resolve `primaryPath` as the repository's primary worktree checkout, not necessarily the current working directory when the cwd is a linked worktree.

#### Scenario: Invalid change name rejected
- **WHEN** the user runs `openspec-ops start Add_Dark_Mode`
- **THEN** the process exits with code `1`
- **AND** the JSON/error code is `invalid_change_name` when `--json` is set

#### Scenario: Defaults from change name
- **WHEN** the user runs `openspec-ops start add-dark-mode` inside a git repo whose primary path is `/repo`
- **THEN** the workspace path used is `/repo/.worktrees/add-dark-mode`
- **AND** the branch used is `add-dark-mode`

#### Scenario: Overrides
- **WHEN** the user runs `openspec-ops start add-dark-mode --branch openspec/add-dark-mode --path /tmp/wt-dark`
- **THEN** the system uses branch `openspec/add-dark-mode` and path `/tmp/wt-dark`

#### Scenario: Start from inside another linked worktree still anchors to primary
- **WHEN** the current directory is `/repo/.worktrees/foo`
- **AND** the user runs `openspec-ops start bar`
- **THEN** the new worktree path is `/repo/.worktrees/bar`
- **AND** the system does not create `/repo/.worktrees/foo/.worktrees/bar` by default

---

### Requirement: Repository and base resolution
When `--repo` is omitted, the system SHALL discover the git repository from the current working directory.

If no git repository is found, the system MUST exit with code `2` and error code `not_a_git_repo`.

When `start` must create a new branch, the system SHALL resolve `base` in this order:

1. `--base` if provided and resolvable
2. `refs/remotes/origin/HEAD` if present
3. local branch `main` or `master` if present

If no base can be resolved, the system MUST exit with code `2` and error code `base_unresolved`.

The system MUST NOT default base to the current `HEAD` feature branch unless the user passes `--base HEAD` (or another explicit ref).

#### Scenario: Not a git repo
- **WHEN** the user runs `openspec-ops start add-dark-mode` outside any git work tree
- **THEN** the process exits with code `2`
- **AND** the error code is `not_a_git_repo`

#### Scenario: Explicit base used for new branch
- **WHEN** branch `add-dark-mode` does not exist
- **AND** the user runs `openspec-ops start add-dark-mode --base origin/main`
- **THEN** the new branch is created from `origin/main`

---

### Requirement: Start creates or reuses a workspace
`openspec-ops start <change>` SHALL ensure a git worktree exists for the change's branch and path.

The command MUST be idempotent:

- If `path` is already a registered worktree checked out to the expected `branch`, the command MUST exit `0` with `action` = `reused` and make no changes
- If `path` is missing and the branch is missing, the system MUST create the branch from the resolved base, then `git worktree add` the path
- If `path` is missing and the branch exists and is not checked out elsewhere, the system MUST add a worktree for that existing branch without resetting the branch to base

Conflict rules:

- If `path` exists but is not a registered worktree → exit `3`, `path_not_worktree`
- If `path` is a worktree for a different branch → exit `3`, `branch_mismatch` or `path_occupied`
- If the expected branch is already checked out in another path → exit `3`, `branch_busy`

`start` MUST NOT switch the primary worktree's HEAD, MUST NOT create OpenSpec change artifacts, and MUST NOT delete existing branches.

#### Scenario: Happy path create
- **WHEN** neither path nor branch exists for `add-dark-mode`
- **AND** the user runs `openspec-ops start add-dark-mode --json`
- **THEN** the process exits with code `0`
- **AND** `result.action` is `created`
- **AND** a git worktree exists at the default path on branch `add-dark-mode`

#### Scenario: Idempotent reuse
- **WHEN** a correct worktree already exists for `add-dark-mode`
- **AND** the user runs `openspec-ops start add-dark-mode --json` again
- **THEN** the process exits with code `0`
- **AND** `result.action` is `reused`

#### Scenario: Reuse existing free branch
- **WHEN** branch `add-dark-mode` exists but has no worktree
- **AND** the user runs `openspec-ops start add-dark-mode`
- **THEN** the system creates a worktree at the default path using the existing branch
- **AND** the branch tip is not reset to base

#### Scenario: Branch busy
- **WHEN** branch `add-dark-mode` is already checked out in another worktree path
- **AND** the default path does not exist
- **AND** the user runs `openspec-ops start add-dark-mode`
- **THEN** the process exits with code `3`
- **AND** the error code is `branch_busy`

#### Scenario: Path occupied by non-worktree directory
- **WHEN** `<primary>/.worktrees/add-dark-mode` exists as a normal directory
- **AND** it is not a registered git worktree
- **AND** the user runs `openspec-ops start add-dark-mode`
- **THEN** the process exits with code `3`
- **AND** the error code is `path_not_worktree`

---

### Requirement: Where locates a workspace
`openspec-ops where <change>` SHALL resolve the workspace for a change and print its location.

Discovery order:

1. The expected path (`--path` or default) if it is a registered worktree
2. Otherwise, a unique registered worktree whose branch equals the expected branch

If none match, the process MUST exit with code `5` and error code `not_found`.

If multiple worktrees match by branch, the process MUST exit with code `3` and error code `ambiguous`.

On success, human-readable mode MUST end with a line that is solely the absolute workspace path.

`where` MUST be read-only.

#### Scenario: Found by default path
- **WHEN** a worktree exists at `<primary>/.worktrees/add-dark-mode` on branch `add-dark-mode`
- **AND** the user runs `openspec-ops where add-dark-mode --json`
- **THEN** the process exits with code `0`
- **AND** `result.found` is `true`
- **AND** `result.path` is that worktree path
- **AND** `result.matchedBy` is `path`

#### Scenario: Not found is strict failure
- **WHEN** no worktree matches change `missing-change`
- **AND** the user runs `openspec-ops where missing-change`
- **THEN** the process exits with code `5`
- **AND** the error code is `not_found`

#### Scenario: Dirty detection
- **WHEN** the matched worktree has a non-empty `git status --porcelain=v1`
- **AND** the user runs `openspec-ops where add-dark-mode --json`
- **THEN** `result.dirty` is `true`

#### Scenario: Clean detection
- **WHEN** the matched worktree has empty porcelain status
- **AND** the user runs `openspec-ops where add-dark-mode --json`
- **THEN** `result.dirty` is `false`

---

### Requirement: Finish removes worktree and retains branch unless merged cleanup applies
`openspec-ops finish <change>` SHALL remove the change's registered worktree when one exists (subject to dirty/`--force` and submodule teardown rules).

Finish MUST NOT run OpenSpec archive, MUST NOT merge, and MUST NOT push except as required to delete a remote branch during merged-branch cleanup.

Finish MUST retain the local branch when no merged PR is verified for the change head, and when `--keep-branch` is set. Finish MAY delete local and remote change branches when a merged PR is verified and `--keep-branch` is not set.

If the worktree has a dirty working tree and `--force` is not set, the process MUST exit with code `4` and error code `worktree_dirty`.

With `--force`, the system MAY remove a dirty worktree. `--force` MUST NOT force-delete unmerged branches.

When no worktree is registered, finish MUST NOT fail with `not_found` solely due to missing worktree if merged-branch cleanup still applies.

#### Scenario: Clean finish with unmerged branch keeps branch
- **WHEN** the worktree exists and is clean
- **AND** no merged PR exists for the change branch
- **AND** the user runs `openspec-ops finish <change> --json`
- **THEN** the worktree is removed
- **AND** the local branch is retained

#### Scenario: Clean finish with merged PR may delete branch
- **WHEN** the worktree exists and is clean
- **AND** a merged PR exists for the change branch
- **AND** finish is run without `--keep-branch`
- **THEN** the worktree is removed
- **AND** local and remote branches may be deleted when present

#### Scenario: Dirty finish refused
- **WHEN** the worktree is dirty
- **AND** the user runs finish without `--force`
- **THEN** the command fails without removing the worktree

#### Scenario: Forced dirty finish
- **WHEN** the worktree is dirty
- **AND** the user runs finish with `--force`
- **THEN** the worktree may be removed
- **AND** unmerged branches are still not force-deleted solely due to `--force`

#### Scenario: not_found worktree does not hard-fail finish if branch cleanup applies
- **WHEN** no worktree exists
- **AND** finish is invoked for a change with a merged PR and existing local or remote branch
- **THEN** finish does not fail with not_found solely due to missing worktree

---

### Requirement: Doctor reports workspace health read-only
`openspec-ops doctor` SHALL inspect the repository's worktrees and default worktree root without modifying git state.

When checks complete successfully as a read operation, the process MUST exit with code `0` even if issues are found.

`doctor` result MUST include:

- `primaryPath`
- `worktreeRoot` (default `<primary>/.worktrees`)
- `worktrees` array of registered non-primary worktrees with `path`, `branch`, `head`, `dirty`, and `inferredChange`
- `issues` array and `summary` counts for `error`, `warning`, and `info`

Phase 0 issue ids MUST include at least:

- `stale_worktree_dir` (warning): entry under the worktree root that is not a registered worktree
- `missing_worktree_path` (error): registered worktree path missing on disk
- `worktree_without_change_dir` (info): worktree present, inferred change name set, but no `openspec/changes/<change>` directory is found in that worktree or primary (omit this class of issue when the repo has no `openspec/` tree)

`inferredChange` MUST be the worktree directory leaf when it matches the change-name pattern; otherwise `null`.

#### Scenario: Doctor on healthy repo
- **WHEN** the user runs `openspec-ops doctor --json` in a valid git repo with no issues
- **THEN** the process exits with code `0`
- **AND** `result.summary.error` is `0`
- **AND** `result.issues` is an empty array

#### Scenario: Stale directory reported
- **WHEN** `<primary>/.worktrees/orphan-dir` exists and is not a registered worktree
- **AND** the user runs `openspec-ops doctor --json`
- **THEN** the process exits with code `0`
- **AND** an issue with id `stale_worktree_dir` and severity `warning` is present

#### Scenario: Doctor outside git fails environment
- **WHEN** the user runs `openspec-ops doctor` outside a git repository
- **THEN** the process exits with code `2`
- **AND** the error code is `not_a_git_repo`

---

### Requirement: Stable JSON envelope and exit codes
When `--json` is passed, stdout MUST contain a single JSON object and MUST NOT interleave non-JSON logs.

Successful JSON MUST have this shape:

- `schemaVersion` = `1` (integer)
- `ok` = `true`
- `command` = the subcommand name
- `result` = object

Failed JSON MUST have:

- `schemaVersion` = `1`
- `ok` = `false`
- `command` = the subcommand name
- `error.code` = stable snake_case string
- `error.message` = human-readable string
- `error.details` = object (empty object if none)

Exit codes MUST follow:

| Code | Meaning |
|---|---|
| 0 | success (including idempotent reuse; doctor with issues) |
| 1 | usage / invalid_change_name |
| 2 | not_a_git_repo / base_unresolved / primary_unresolved |
| 3 | path_occupied / path_not_worktree / branch_busy / branch_mismatch / ambiguous |
| 4 | worktree_dirty |
| 5 | not_found |
| 10 | git_failed / internal |

#### Scenario: JSON success envelope
- **WHEN** the user runs a successful `openspec-ops start add-dark-mode --json`
- **THEN** stdout parses as JSON with `schemaVersion` = `1`, `ok` = `true`, and `command` = `start`

#### Scenario: JSON error envelope
- **WHEN** the user runs `openspec-ops where missing-change --json`
- **THEN** the process exits with code `5`
- **AND** stdout parses as JSON with `ok` = `false` and `error.code` = `not_found`
- **AND** `error.details` is an object

---

### Requirement: No OpenSpec semantic coupling
Workspace lifecycle commands MUST NOT create, modify, archive, or validate OpenSpec change artifacts as part of their successful path.

Informational fields such as `changeDirExists` or doctor info issues MAY inspect the filesystem for `openspec/changes/<change>` but MUST NOT call the OpenSpec CLI and MUST NOT treat a missing change directory as a start failure.

#### Scenario: Start without an OpenSpec change directory still succeeds
- **WHEN** `openspec/changes/add-dark-mode` does not exist
- **AND** the user runs `openspec-ops start add-dark-mode --json`
- **THEN** the process exits with code `0`
- **AND** a worktree is created or reused
- **AND** `result.changeDirExists` is `false` when reported

---

### Requirement: Where result includes top-level submodule summary
On successful `where`, the result object SHALL include a `submodules` field: an array of objects with at least `path`, `detached`, and `dirty` for top-level submodules under the worktree (`[]` when none).

schemaVersion remains 1. Field is additive for readers that ignore unknown keys.

#### Scenario: additive field does not change not_found
- **WHEN** where cannot find a worktree
- **THEN** behavior remains not_found as today
- **AND** no submodule probe is required

### Requirement: Finish dirty error mentions submodules
When finish fails with `worktree_dirty`, the message SHALL mention that uncommitted submodule work can contribute to dirtiness and that force removes the worktree without preserving uncommitted changes.

#### Scenario: worktree_dirty still exit 4
- **WHEN** finish is invoked on a dirty worktree without `--force`
- **THEN** the command still fails with the dirty worktree error class
- **AND** does not auto-clean or auto-commit

---

### Requirement: ship is a workspace lifecycle command
The openspec-ops CLI SHALL expose `ship` as a first-class command alongside start/where/finish/doctor, accepting a change name and operating on the resolved change worktree.

#### Scenario: ship appears in CLI help
- **WHEN** a user runs `openspec-ops --help`
- **THEN** usage text includes a `ship` command summary

### Requirement: ship reuses worktree resolution
Ship MUST resolve the target worktree using the same change name → path/branch rules as `where`/`start` (defaults: branch=`<change>`, path=`<primary>/.worktrees/<change>`).

#### Scenario: ship not_found when no worktree
- **WHEN** no worktree exists for the change
- **AND** the user runs `openspec-ops ship <change> --json`
- **THEN** the command fails with not_found (or equivalent) and does not create a worktree implicitly unless design explicitly adds ensure (v1: do not implicit start)


---

### Requirement: prune is a workspace lifecycle command
The openspec-ops CLI SHALL expose `prune` as a command that accepts a change name and optional remote/branch overrides, documented in CLI help. Prune is deprecated for primary closeout in favor of finish.

#### Scenario: help lists prune
- **WHEN** a user runs `openspec-ops --help`
- **THEN** usage includes a `prune` command summary

### Requirement: Finish deletes merged branches unless keep-branch
`openspec-ops finish` SHALL delete the change branch after worktree removal when a merged PR is verified and `--keep-branch` is not set. Operators MUST be able to pass `--keep-branch` to skip all branch deletion.

When no merged PR is verified, finish MUST retain the branch (`branchDeleted` false unless local delete succeeded for merged cleanup).

#### Scenario: result reports whether branch was deleted
- **WHEN** finish completes
- **THEN** the result includes whether the local branch was deleted or kept (e.g. `branchDeleted` and/or structured branch fields)

#### Scenario: unmerged keeps branch
- **WHEN** finish succeeds and no merged PR is verified
- **THEN** the branch is retained


---

### Requirement: merge is a lifecycle CLI command
The openspec-ops CLI SHALL expose `merge` alongside other lifecycle commands in help text, accepting a change name and optional method/branch/repo flags.

#### Scenario: help lists merge
- **WHEN** a user runs `openspec-ops --help`
- **THEN** usage includes a `merge` command summary

---

### Requirement: Finish teardown accounts for submodules before worktree remove
The finish command’s worktree removal path SHALL attempt to unload initialized top-level submodules in the target worktree before invoking `git worktree remove`, so that git’s “worktree contains submodules” refusal does not leave finish permanently stuck on typical monorepo layouts.

#### Scenario: finish does not rely on manual deinit for happy path
- **WHEN** a clean change worktree contains an initialized top-level submodule
- **AND** finish is run without prior manual submodule deinit
- **THEN** finish still completes worktree removal on the happy path

---

### Requirement: Doctor can flag change location mismatch
Doctor issue taxonomy SHALL include the stable id **`change_location_mismatch`** for active-vs-archived change location mismatch.

#### Scenario: issue id is stable
- **WHEN** doctor reports the split-brain condition
- **THEN** the issue id is `change_location_mismatch`
