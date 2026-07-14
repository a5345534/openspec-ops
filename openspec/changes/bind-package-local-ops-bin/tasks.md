## 1. Runtime Resolution Contract

- [x] 1.1 Add a detailed binary resolver result with absolute path, provenance, and stable invalid/unavailable diagnostics while retaining the existing nullable-path compatibility API.
- [x] 1.2 Validate explicit, package, PATH, and module-relative candidates as regular executable files; make an invalid explicit override fail closed.
- [x] 1.3 Apply explicit-override → loaded-package → PATH precedence when package context is present and safely support package paths containing spaces or prompt-significant characters.
- [x] 1.4 Add a pure runtime-binding formatter that JSON-encodes the selected executable and can be reused by extension context and deliver follow-ups.

## 2. Pi Runtime Handoff

- [x] 2.1 Resolve the guided extension runtime once per Pi session, preserve explicit `OPENSPEC_OPS_BIN`, and expose a non-explicit resolved path to descendant tool processes through session environment only.
- [x] 2.2 Inject the validated runtime binding in `before_agent_start` so direct agent-driven CLI-backed ops skills receive the same executable identity.
- [x] 2.3 Gate `/ops-deliver` scheduling on runtime availability and bind the exact executable/source alongside the required change name in its follow-up.
- [x] 2.4 Ensure extension-owned start/where/next/metrics local probes use the shared package-affine resolver without changing lifecycle behavior.

## 3. Skills and Operator Guidance

- [x] 3.1 Update package-exported CLI-backed ops skills and matching prompts to accept an extension-bound executable before standalone env/PATH fallback, quote it safely, and retain JSON/exit/guardrail behavior.
- [x] 3.2 Update ops-deliver instructions to preserve the bound runtime across all CLI-backed pipeline stages and hard-stop if it becomes unusable.
- [x] 3.3 Update doctor diagnostics to distinguish invalid explicit override, corrupt/missing package bin, and absent fallback with actionable package repair guidance.
- [x] 3.4 Update README package-install guidance to state that loaded project-local package workflows are self-contained while env/PATH/global link remain explicit/direct-shell options.

## 4. Verification

- [x] 4.1 Add resolver tests for explicit precedence, invalid explicit fail-closed behavior, package-over-PATH affinity, executable checks, module/PATH fallback, and paths containing spaces.
- [x] 4.2 Add extension handoff tests proving project-local `/ops-deliver` without global link binds the package bin, explicit env remains authoritative, and unavailable runtime schedules no follow-up.
- [x] 4.3 Add package/runtime integration coverage for a git-style package clone with no `dist/` using bundled `tsx`, plus a non-executable/missing-bin failure case.
- [x] 4.4 Add consistency tests over package-exported CLI-backed skill/prompt resolution blocks and confirm the package remains ops-only.
- [x] 4.5 Run OpenSpec validation, typechecks, extension typecheck/smoke, full tests, build, package dry-run, and diff hygiene checks.
