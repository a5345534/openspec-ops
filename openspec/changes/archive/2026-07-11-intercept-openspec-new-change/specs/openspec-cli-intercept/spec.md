## ADDED Requirements

### Requirement: Pre-exec intercept of openspec new change
The system SHALL provide a wrapper entrypoint named in a way that does not replace the global `openspec` binary by default (e.g. `openspec-ops-intercept`) that can intercept invocations equivalent to `openspec new change <name>` **before** the upstream command creates the change directory.

The wrapper MUST forward the invocation to a resolved real OpenSpec binary after optional ensure side effects, preserving argv intent (including `--json` and other flags).

The wrapper MUST NOT reimplement OpenSpec change scaffolding logic.

#### Scenario: new change is detected before upstream runs
- **WHEN** the wrapper is invoked with arguments that mean `new change` and a valid kebab-case change name
- **AND** intercept policy is `on`
- **THEN** the wrapper performs openspec-ops ensure side effects for that name before spawning the real OpenSpec binary

#### Scenario: unrelated openspec commands pass through
- **WHEN** the wrapper is invoked with arguments that are not `new change <name>`
- **THEN** the wrapper spawns the real OpenSpec binary without running `openspec-ops start`

#### Scenario: scaffolding remains upstream
- **WHEN** the wrapper handles `new change`
- **THEN** the change directory and metadata are created by the real OpenSpec CLI, not by openspec-ops reimplementation

---

### Requirement: Resolve real OpenSpec binary without recursion
The wrapper SHALL resolve the real OpenSpec executable without invoking itself recursively.

Resolution MUST support at least:

1. `OPENSPEC_REAL_BIN` when set to an existing executable that is not the wrapper itself
2. PATH lookup that skips the wrapper’s own path
3. A clear error if no real binary can be found

#### Scenario: OPENSPEC_REAL_BIN wins
- **WHEN** `OPENSPEC_REAL_BIN` points to a valid real openspec binary
- **THEN** the wrapper uses that binary for forwarding

#### Scenario: missing real binary fails clearly
- **WHEN** no real OpenSpec binary can be resolved
- **THEN** the wrapper exits non-zero with guidance
- **AND** does not create an OpenSpec change directory itself

---

### Requirement: Ensure worktree before new change when policy on
When intercept policy is `on` and `new change <name>` is intercepted, the wrapper SHALL invoke `openspec-ops start <name>` (via existing CLI JSON contract) before forwarding.

On ensure hard failure under policy `on`, the wrapper MUST NOT run upstream `new change` (fail-closed for ensure).

When policy is `off`, the wrapper MUST forward without ensure.

#### Scenario: policy on ensures then creates
- **WHEN** policy is `on` and `new change add-dark-mode` is intercepted
- **AND** `openspec-ops start add-dark-mode` succeeds (created or reused)
- **THEN** the real `openspec new change add-dark-mode` runs afterward

#### Scenario: policy on start failure blocks new change
- **WHEN** policy is `on`
- **AND** `openspec-ops start` fails with a hard error
- **THEN** the wrapper does not run upstream `new change`
- **AND** exits non-zero

#### Scenario: policy off is pure forward
- **WHEN** policy is `off`
- **AND** `new change add-dark-mode` is intercepted as argv
- **THEN** the wrapper does not call `openspec-ops start`
- **AND** forwards to real OpenSpec

---

### Requirement: Prefer worktree cwd for upstream new change after ensure
When ensure succeeded and a workspace path is known, the wrapper SHALL run the real OpenSpec `new change` with cwd set to that workspace path so the change scaffold is created in the worktree when OpenSpec resolves the nearest root from cwd.

The wrapper is NOT required to change the parent process or subsequent agent commands’ working directory.

#### Scenario: cwd is worktree after successful start
- **WHEN** start returns a workspace path for the change
- **AND** policy performed ensure successfully
- **THEN** the spawned OpenSpec process uses that path as its working directory

#### Scenario: successful ensure emits worktree hint on stderr
- **WHEN** ensure succeeds and a workspace path is known
- **THEN** the wrapper writes a brief human-readable hint including that path to stderr (so agents/users can cd for later writes)

---

### Requirement: Intercept policy env is on or off only
The wrapper SHALL read policy from environment variable `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE` with values `on`|`off` (case-insensitive).

The default policy MUST be `on` when unset.

The wrapper is NOT required to implement an `ask` policy in this version.

#### Scenario: default is on
- **WHEN** `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE` is unset
- **THEN** the wrapper behaves as policy `on` for `new change` intercept

#### Scenario: off disables ensure side effects
- **WHEN** `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE=off`
- **THEN** `new change` invocations do not trigger `openspec-ops start`

---

### Requirement: Change name parsing
The wrapper SHALL extract the change name from `new change` argv only when it matches kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$`.

If the name is missing or invalid, the wrapper MUST forward to real OpenSpec without ensure (upstream validates/errors).

#### Scenario: invalid name does not ensure
- **WHEN** argv is `new change Not_Valid`
- **THEN** the wrapper does not call `openspec-ops start`
- **AND** forwards to real OpenSpec

---

### Requirement: Documentation of shim install and non-modification of OpenSpec
The root README SHALL document:

- That intercept is an opt-in wrapper (`openspec-ops-intercept`), not a fork and not the default global `openspec` name
- How to enable via alias/PATH and set `OPENSPEC_REAL_BIN` if needed
- `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE=on|off` (default on)
- That users need not pass change names on `/opsx-propose` for ensure-at-create when agents run `openspec new change` through the wrapper
- That only the intercept child cwd is switched to the worktree; later commands may need an explicit cd
- That OpenSpec package source is unmodified

#### Scenario: README describes intercept and disable
- **WHEN** reading the root README after this change
- **THEN** it describes the new-change intercept path, binary name, and how to turn it off
