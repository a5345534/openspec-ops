# pi-package-ops-surface Specification

## Purpose

Rules for what the openspec-ops Pi package may export so it cannot shadow consumer OpenSpec skills/prompts (ops-* only pure sidecar).
## Requirements
### Requirement: Pi package exports only ops-prefixed skills and prompts plus extension
The openspec-ops package manifest (`package.json` `pi` key) SHALL export:

- Extensions under the package extension path
- Skills whose paths match **ops-*** only (e.g. `.pi/skills/ops-start/`)
- Prompts whose paths match **ops-*** only (e.g. `.pi/prompts/ops-start.md`)

The manifest MUST NOT list paths that load `openspec-*` skills or `opsx-*` prompts as package resources.

#### Scenario: pi.skills does not include openspec-propose
- **WHEN** reading package.json `pi.skills` after this change
- **THEN** no glob or path includes `openspec-propose` or other `openspec-*` skill directories for package load

#### Scenario: pi.prompts does not include opsx-propose
- **WHEN** reading package.json `pi.prompts` after this change
- **THEN** no glob or path includes `opsx-propose` or other `opsx-*` prompts for package load

---

### Requirement: Package must not register a global openspec binary name
The package.json `bin` field MUST NOT expose a binary named `openspec`.

Allowed bins include `openspec-ops` and may include `openspec-ops-intercept`.

#### Scenario: bin map has no openspec key
- **WHEN** reading package.json `bin`
- **THEN** there is no key `openspec`

---

### Requirement: Consumer OpenSpec skills remain authoritative
Installing or updating the openspec-ops Pi package MUST NOT require replacing the consumer project’s own OpenSpec-generated skills/prompts.

Documentation SHALL state that project `openspec init` / `openspec update` assets remain the OpenSpec workflow authority and that this package ships **ops-*** only.

#### Scenario: README states non-replacement
- **WHEN** reading the root README packaging section after this change
- **THEN** it states that openspec-ops does not replace consumer OpenSpec skills/prompts and ships ops-* only

---

### Requirement: Vendored OpenSpec Pi assets are not package-loaded
If vendored copies of upstream OpenSpec skills/prompts are retained in the repository, they MUST live outside package-exported Pi paths (e.g. under `vendor/openspec-pi-ref/`) and MUST NOT appear in `pi.skills` or `pi.prompts`.

#### Scenario: quarantine path not in pi.skills
- **WHEN** vendored openspec skills exist under `vendor/openspec-pi-ref/`
- **THEN** `pi.skills` does not include that path

---

### Requirement: Worktree alignment without shipping openspec-propose
Worktree write alignment for consumers SHALL be achievable without loading a package skill named `openspec-propose`.

Allowed mechanisms: extension handoff, opt-in CLI intercept, doctor diagnostics, and a documentation **snippet** consumers may paste into **their** propose skill.

This version is NOT required to ship a thin `ops-propose` orchestrator skill.

#### Scenario: alignment not dependent on package openspec-propose
- **WHEN** a consumer installs openspec-ops with only ops-* skills exported
- **THEN** documented alignment paths still exist (extension and/or intercept and/or snippet)

---

### Requirement: Doctor does not require package-local openspec-propose markers
Doctor diagnostics MUST NOT fail or warn solely because the **openspec-ops package tree** lacks `.pi/skills/openspec-propose` with worktree-alignment markers.

If marker checks exist, they apply to a **consumer project** propose skill path when that file is present, not to the package as a substitute OpenSpec distribution.

#### Scenario: package root without openspec-propose is not a marker failure
- **WHEN** doctor runs with package root that has no `.pi/skills/openspec-propose/SKILL.md`
- **THEN** it does not emit `propose_skill_alignment_markers_missing` for that package path solely due to absence of that skill

---

### Requirement: Verification of export surface
The project SHALL have an automated check (test or script in the test suite) that fails if `package.json` `pi.skills` or `pi.prompts` patterns would include `openspec-` or `opsx-` package resources.

#### Scenario: checked-in package.json is ops-only
- **WHEN** the export-surface test runs against the repository package.json
- **THEN** it passes only if pi skill/prompt patterns are ops-allowlisted and do not export openspec-/opsx- resources

### Requirement: Package publishes ops-next skill
The npm/pi package `files` list SHALL include the ops-next skill directory so consumers receive guided next-step alongside other ops-* skills.

#### Scenario: files includes ops-next
- **WHEN** inspecting package.json `files` after this change
- **THEN** an entry covers `.pi/skills/ops-next` (or equivalent path)

### Requirement: Published dist does not ship deleted auto modules
After a clean production build, the package MUST NOT contain compiled modules under `dist/auto-ensure`, `dist/auto-review`, `dist/auto-finish`, or `dist/auto-impl-review` corresponding to removed source trees.

#### Scenario: no dist auto-ensure after build
- **WHEN** `npm run build` completes cleanly
- **THEN** `dist/auto-ensure` is absent

### Requirement: ops-deliver prompt not on package export surface
The package `files` allowlist SHALL include the ops-deliver skill directory and SHALL NOT list `.pi/prompts/ops-deliver.md`.

#### Scenario: files list has skill without deliver prompt
- **WHEN** `package.json` `files` is inspected
- **THEN** an entry covering `.pi/skills/ops-deliver` is present
- **AND** `.pi/prompts/ops-deliver.md` is absent from `files`

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

