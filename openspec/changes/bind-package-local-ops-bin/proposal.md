## Why

A project-local Pi package installation can load openspec-ops commands and skills while its agent-driven lifecycle still hard-stops because downstream skills cannot discover the executable bundled in that same package clone. Requiring a separate `npm link` or preconfigured `OPENSPEC_OPS_BIN` makes the advertised `/ops-deliver` package workflow non-self-contained and permits package/CLI version skew.

## What Changes

- Establish one deterministic session runtime contract that resolves an executable openspec-ops CLI from an explicit operator override, the loaded package clone, or PATH, with package-version affinity when no override is set.
- Validate that a resolved candidate is a regular executable file and produce a stable, clear failure when no usable CLI exists.
- Have the guided extension inject the resolved absolute CLI path into agent context and explicitly bind it into `/ops-deliver` follow-ups, while preserving an explicitly configured `OPENSPEC_OPS_BIN`.
- Make CLI-backed ops skills/prompts accept and prefer the extension-bound runtime path before falling back to their self-contained env/PATH resolution rules.
- Safely encode paths containing spaces or prompt-significant characters and invoke the executable as an argv path rather than shell-interpolated text.
- Add package-install/runtime tests covering no global link, explicit override precedence, package/PATH version affinity, missing/non-executable bins, and paths containing spaces.
- Update README and doctor guidance so project-local Pi package usage does not imply that global linking is mandatory for package-originated workflows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ops-deliver`: Bind and use the extension-resolved executable throughout the batch pipeline, not only the change name.
- `pi-ops-skills`: Add a shared extension-bound binary source while retaining self-contained env/PATH fallback and hard-stop rules.
- `pi-package-ops-surface`: Guarantee that a correctly installed project-local Pi package can use its bundled CLI without a second global installation step.

## Impact

- Guided extension handoff/config injection, ops runtime binary resolution helpers, and doctor diagnostics.
- Package-exported CLI-backed ops skills and matching prompts that document binary resolution.
- Runtime/package tests and README installation guidance.
- No change to lifecycle station order, merge consent, review gates, OpenSpec ownership, package ops-only export surface, or direct shell users who intentionally configure `OPENSPEC_OPS_BIN`/PATH.
