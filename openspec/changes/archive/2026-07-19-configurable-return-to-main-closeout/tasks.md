## 1. Policy Configuration

- [x] 1.1 Add typed `finish.return-to-main` session/env/default resolution and validation to `src/pi-config`.
- [x] 1.2 Expose the effective policy through `/ops-config`, per-turn injection, tests, and documentation.

## 2. Strict Finish Closeout

- [x] 2.1 Add and parse the composite `--return-to-main` finish option while preserving default and legacy flag behavior.
- [x] 2.2 Implement clean-primary preflight, current remote/base synchronization, and final primary snapshot reporting.
- [x] 2.3 Recursively inventory initialized submodules, resolve each remote default branch from its immediate parent gitlink, and attach only through non-destructive exact-pin fast-forward behavior.
- [x] 2.4 Return successful per-submodule state and structured `return_to_main_needs_human` diagnostics for dirty, unresolved, stale, ahead, or diverged cases.

## 3. Deliver Integration

- [x] 3.1 Update `ops-deliver` and `ops-finish` skills to map effective policy to strict finish and hard-stop semantics.
- [x] 3.2 Update README/CLI guidance for policy configuration, environment persistence, default-off behavior, and safety guarantees.

## 4. Verification

- [x] 4.1 Add config, CLI parsing, finish integration, remote-default resolution, exact-pin attachment, and structured-result tests.
- [x] 4.2 Run targeted tests, full tests, typecheck, build, OpenSpec validation, and diff checks.
