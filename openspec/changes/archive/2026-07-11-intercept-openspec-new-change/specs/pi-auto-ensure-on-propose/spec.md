## MODIFIED Requirements

### Requirement: Detect propose intent with strong signals only
The extension SHALL treat input as propose-intent only for strong slash forms, including at least:

- `/opsx-propose` at the start of input (optional args after)
- `/opsx:propose` at the start of input if supported in the environment

The extension MUST NOT treat bare-word chat containing “propose” as propose-intent for auto-ensure in this capability.

Slash-based ensure remains an optional accelerator when a kebab name is present on the slash line. Primary ensure-before-scaffold for agent-named changes is defined by capability `openspec-cli-intercept` on `openspec new change`.

#### Scenario: opsx-propose is detected
- **WHEN** the user input begins with `/opsx-propose`
- **THEN** the extension classifies the input as propose-intent for policy evaluation

#### Scenario: explore is not detected as propose
- **WHEN** the user input begins with `/opsx-explore`
- **THEN** the extension does not run workspace ensure for that input as part of this capability

#### Scenario: slash without name does not ensure at input
- **WHEN** the user submits `/opsx-propose` with no parseable change name
- **AND** policy is `on`
- **THEN** the extension does not call `openspec-ops start` at input time for that submission
