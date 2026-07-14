## MODIFIED Requirements

### Requirement: Shared runtime rules content
Every CLI-backed ops skill and ops prompt SHALL instruct the agent to:

1. Use a validated exact openspec-ops executable path supplied by the loaded guided extension when an extension-bound runtime is present
2. Otherwise resolve `$OPENSPEC_OPS_BIN` if set and executable, then `openspec-ops` on PATH, then stop with install/link/package-repair guidance
3. Quote the selected executable safely and invoke it as a command path with argv, not by concatenating untrusted path text into `sh -c`
4. Always pass `--json` on CLI invocations
5. Parse a single JSON object from stdout and require `schemaVersion` equal to `1` (warn or stop on mismatch)
6. Use exit codes `0|1|2|3|4|5|10` with the Phase 0 meanings (success; usage/invalid name; repo/base errors; conflicts; dirty; not found; git/internal)
7. Prefer `error.code` over scraping `error.message` for control flow
8. Never run raw `git worktree` / `git switch` as a substitute for the CLI
9. Never replace or silently implement `/opsx-propose`, `/opsx-apply`, `/opsx-archive`, or `/opsx-sync`
10. Never commit, push, open PRs, merge, or delete branches as part of these skills
11. Never pass `--force` without explicit user consent in the current turn
12. Prefer subsequent implementation/OpenSpec commands use the workspace `path` as cwd when known

The optional extension-bound source MUST NOT make a document dependent on the extension: when no binding is present, env/PATH fallback and hard-stop behavior SHALL remain fully specified in that same skill/prompt.

#### Scenario: extension-bound package binary is used
- **WHEN** a CLI-backed ops skill receives a validated runtime binding from the loaded guided extension
- **THEN** the instructions require using that exact executable before standalone env/PATH discovery
- **AND** paths containing spaces remain one safely quoted executable argument

#### Scenario: missing binary stops without git fallback
- **WHEN** no extension binding, explicit env, or PATH executable can be resolved
- **THEN** the instructions require stopping with install/package guidance
- **AND** the instructions forbid falling back to manual `git worktree add`

#### Scenario: JSON schema version pinned
- **WHEN** the agent runs an ops CLI command per the skill
- **THEN** the instructions require `--json` and `schemaVersion === 1` handling

### Requirement: README documents Pi usage
The root `README.md` SHALL document:

- The mapping `/ops-start` → OpenSpec `/opsx-*` → `/ops-finish`
- That a loaded project-local openspec-ops Pi package supplies and binds its own package-local CLI for package-originated workflows
- That `OPENSPEC_OPS_BIN` remains the explicit override and PATH/global linking remains useful for direct shell or extension-absent skill usage, but is not mandatory for the normal loaded-package slash workflow
- Non-goals: no auto-hijack of OpenSpec commands; prompts/skills are full-text maintained in pairs

#### Scenario: README mentions self-contained package runtime
- **WHEN** reading the root README after this change
- **THEN** it describes using ops-start before OpenSpec work and ops-finish for worktree cleanup
- **AND** does not require `npm link` merely to run `/ops-deliver` from a correctly loaded project-local package

## ADDED Requirements

### Requirement: Guided extension injects one validated runtime binding
The guided extension SHALL resolve the current session's openspec-ops executable with provenance and inject a safely encoded absolute binding before agent start. If no explicit `OPENSPEC_OPS_BIN` was supplied, it SHALL make the resolved package/PATH executable available to Pi tool subprocesses through the session process environment. It MUST NOT overwrite an explicit operator override.

#### Scenario: project-local package binding
- **WHEN** the extension is loaded from a project-local package clone
- **AND** no explicit override is configured
- **THEN** the package-local executable is validated and injected into agent context
- **AND** tool subprocesses inherit the same executable identity

#### Scenario: explicit override is preserved
- **WHEN** `OPENSPEC_OPS_BIN` is explicitly set before extension load
- **THEN** the extension validates and binds that override
- **AND** does not replace it with package or PATH resolution

#### Scenario: path is safely encoded
- **WHEN** the resolved executable path contains spaces, quotes, backticks, or other prompt-significant characters
- **THEN** the injected binding encodes the path without creating additional instructions
- **AND** downstream invocation treats it as one executable path

### Requirement: Binary resolution validates executable identity and source
The shared runtime resolver SHALL return the selected absolute path and its source (`explicit`, `package`, `path`, or module-relative fallback) and SHALL accept only a regular executable file. When a loaded package root is supplied and no explicit override exists, its bundled bin SHALL be preferred over PATH to keep extension, skills, and CLI on the same package version.

#### Scenario: package bin wins over stale PATH binary
- **WHEN** the loaded package has an executable bundled bin
- **AND** PATH also contains a different openspec-ops binary
- **AND** no explicit override is configured
- **THEN** the resolver selects the loaded package bin with package provenance

#### Scenario: invalid explicit override fails closed
- **WHEN** `OPENSPEC_OPS_BIN` is explicitly configured but missing, non-regular, or non-executable
- **THEN** resolution reports that override as invalid
- **AND** does not silently choose package or PATH instead

#### Scenario: no package context falls back to PATH
- **WHEN** no explicit override and no loaded package root are available
- **AND** PATH contains an executable openspec-ops
- **THEN** standalone skill/runtime resolution may use the PATH executable
