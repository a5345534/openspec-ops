## ADDED Requirements

### Requirement: Loaded project-local package supplies its bundled CLI runtime
A correctly installed project-local openspec-ops Pi package SHALL be able to use the executable bundled in that same package clone for package-originated extension and agent-skill workflows without requiring `npm link`, a global openspec-ops installation, or a preconfigured `OPENSPEC_OPS_BIN`.

This guarantee applies when the guided extension is loaded, the package-local `bin/openspec-ops` is a regular executable file, and its packaged runtime dependencies are usable. It MUST NOT register a global `openspec` binary or modify the consumer project's OpenSpec assets.

#### Scenario: git package works without global link
- **WHEN** the package is installed project-locally from a Pi git package source
- **AND** the guided extension, ops skills, package bin, and package runtime dependencies are present
- **AND** no global openspec-ops command or explicit override exists
- **THEN** package slash workflows resolve and use that package-local CLI
- **AND** no second installation/link step is required

#### Scenario: package path contains spaces
- **WHEN** the Pi package clone resides under an absolute path containing spaces
- **THEN** the extension binds the package executable as one safely encoded path
- **AND** agent-driven lifecycle CLI invocation does not split or shell-interpolate the path

#### Scenario: package bin is missing or non-executable
- **WHEN** a loaded package clone lacks a regular executable `bin/openspec-ops`
- **AND** no valid explicit override or allowed fallback is available
- **THEN** the package workflow hard-stops with package repair/override guidance
- **AND** does not schedule a lifecycle pipeline that can only fail later

### Requirement: Package runtime selection preserves explicit overrides and version affinity
The package runtime handoff SHALL preserve a valid explicit `OPENSPEC_OPS_BIN` as the highest-authority operator choice. Without an explicit override, it SHALL prefer the executable from the loaded package clone over a PATH binary so the extension, skills, and CLI originate from the same package version.

#### Scenario: explicit override wins
- **WHEN** a valid explicit `OPENSPEC_OPS_BIN` and a valid package-local bin both exist
- **THEN** the explicit override is selected and bound

#### Scenario: package clone wins over PATH
- **WHEN** no explicit override exists
- **AND** both the loaded package clone and PATH provide executable openspec-ops binaries
- **THEN** the package-local executable is selected

### Requirement: Package binary handoff remains session-local
Resolving and exposing a package-local CLI to skills SHALL affect only the running Pi process, its injected agent context, and descendant tool processes. The system MUST NOT write shell profiles, create global links, modify project configuration, or persist an executable override as a project file.

#### Scenario: handoff leaves installation state unchanged
- **WHEN** the guided extension binds its package-local CLI for a Pi session
- **THEN** no global npm link, shell profile edit, or project config write is performed
- **AND** ending the Pi process removes the session environment handoff naturally
