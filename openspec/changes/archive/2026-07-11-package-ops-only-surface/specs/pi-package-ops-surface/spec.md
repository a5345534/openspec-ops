## ADDED Requirements

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
