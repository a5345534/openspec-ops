---
name: "Package-affine openspec-ops binary handoff"
description: "Pi resolves explicit override, then loaded package bin, then PATH, and binds the exact executable into agent context and deliver follow-ups."
type: architectural-invariant
scope: module:ops-runtime
verified_at: 2026-07-21
source: agent:compact-producer
---

## Runtime executable resolution

For extension-originated workflows, openspec-ops uses this precedence:

1. Valid explicit `OPENSPEC_OPS_BIN`
2. The CLI bundled with the loaded openspec-ops Pi package
3. `openspec-ops` on PATH
4. Module-relative fallback where applicable
5. Clear hard stop

An invalid explicit override fails closed rather than silently falling back. Candidates must be regular executable files. The guided extension resolves the runtime once, preserves explicit overrides, exports the selected absolute path to the Pi session environment, injects a safely JSON-encoded binding into agent context, and repeats it in `/ops-deliver` follow-ups. Package bin precedes PATH to prevent extension/skill/CLI version skew. Paths with spaces must be invoked as one quoted executable path, never concatenated into `sh -c`.

This contract was implemented by PR #29 for issue #28.

## Evidence

- Issue #28 reproduction showed project-local `/ops-deliver` hard-stopped because skills only checked env/PATH although the extension knew `PACKAGE_ROOT`.
- PR #29 merged `bind-package-local-ops-bin`, adding resolver provenance, executable checks, session env/context binding, and deliver follow-up binding.
- A package-clone smoke test with no global link, no PATH CLI, no dist, and spaces in the package path successfully bound and ran the package CLI.

## Why this is shared

All agent-driven lifecycle stages depend on using the same package-compatible CLI; losing this handoff breaks project-local package workflows and can cause version skew.
