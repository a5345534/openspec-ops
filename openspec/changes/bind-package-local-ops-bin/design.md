## Context

Pi can install openspec-ops project-locally under a package-managed directory such as `.pi/git/.../openspec-ops`. The guided extension resolves its own package root and can directly run `<packageRoot>/bin/openspec-ops`, but agent-driven skills receive only natural-language instructions and currently resolve the CLI from `OPENSPEC_OPS_BIN` or PATH. `/ops-deliver` therefore loses executable identity at the extension-to-agent boundary and hard-stops at the first CLI-backed stage when no global link exists. The same gap can affect direct agent-driven ship/merge/finish/where/doctor flows.

The package bin is deliberately usable without checked-in `dist/`: it falls back to package-local `tsx`. The fix must preserve explicit operator overrides, package/CLI version affinity, path safety, skill self-containment, and clear hard stops.

## Goals / Non-Goals

**Goals:**

- Make a correctly installed, extension-loaded project-local Pi package self-contained for its own ops lifecycle commands.
- Resolve one validated absolute executable path with explicit precedence and provenance.
- Carry that path mechanically into the Pi session environment and visibly/diagnostically into agent handoffs.
- Keep all CLI-backed ops skills/prompts able to run without the extension when env/PATH is available.
- Handle spaces and prompt-significant path characters without shell interpolation.
- Detect missing/non-regular/non-executable candidates before scheduling a batch workflow.

**Non-Goals:**

- Replacing the agent/skill implementation of review or OpenSpec stages with an extension-owned orchestrator.
- Installing or building a missing package dependency automatically.
- Downloading an openspec-ops binary or invoking `npx` as fallback.
- Changing lifecycle stations, review rounds, merge consent, or finish safety.
- Registering a global binary, modifying shell profiles, or writing project configuration.
- Making package skills work from a deliberately disabled/unloaded extension when neither env nor PATH resolves a CLI.

## Decisions

### Use a detailed resolver with explicit provenance

The runtime resolver will return a structured result rather than only a nullable string. Resolution for an extension-loaded package is:

1. Explicit `OPENSPEC_OPS_BIN` override, canonicalized relative to the Pi process cwd when needed.
2. `<loadedPackageRoot>/bin/openspec-ops` for package-version affinity.
3. `openspec-ops` found on PATH.
4. Existing module-relative package fallback for non-extension library contexts.
5. A stable unavailable result with candidate/source diagnostics.

An explicitly configured but unusable override is an operator error and fails closed instead of silently selecting a different binary. This prevents a typo from being hidden and preserves override authority. Without an override, the loaded package bin precedes PATH so a stale global link cannot silently run a different CLI version from the extension/skills that defined the workflow.

Every accepted path is normalized to an absolute path, resolves to a regular file, and passes executable access checks. The existing simple `resolveOpsBin()` API may remain as a compatibility wrapper around the detailed resolver.

### Bind the resolved path at both process and prompt boundaries

When the guided extension loads, it resolves the runtime once. If the operator did not provide `OPENSPEC_OPS_BIN`, the extension sets the session process environment variable to the resolved absolute path. Pi tool subprocesses then inherit the same executable path, covering all agent-driven CLI stages rather than only `/ops-deliver`.

The extension also injects a compact runtime binding into `before_agent_start`, and `/ops-deliver` repeats the binding in its explicit follow-up alongside the required change name. This provides diagnosis and instruction even if a tool runner handles environment state differently.

The binding uses JSON string encoding, for example:

```text
REQUIRED: openspec-ops binary is "/absolute/package path/bin/openspec-ops" (source=package).
Use this exact executable (or the inherited OPENSPEC_OPS_BIN) for lifecycle CLI actions.
```

Agents invoke the environment value as a quoted command path (`"$OPENSPEC_OPS_BIN" ...`) or an argv executable, never by concatenating it into `sh -c`. Control characters remain escaped in injected text.

### Skills accept an optional extension-bound source before standalone fallbacks

CLI-backed package skills/prompts update their shared runtime wording to use:

1. A valid extension-bound exact path when present.
2. `OPENSPEC_OPS_BIN` when set and executable.
3. `openspec-ops` on PATH.
4. Clear hard stop; no raw Git or `npx` fallback.

The bound path normally equals the inherited env value because the extension computed both from the same resolution. When the extension is absent, documents remain operationally self-contained through env/PATH and retain existing stop guidance.

### A missing package runtime stops before scheduling deliver

`/ops-deliver` validates runtime availability before beginning metrics attempt state or scheduling its follow-up. A missing or non-executable bundled bin with no fallback yields a direct UI error naming the resolution sources checked. It does not schedule an agent merely to rediscover the same failure.

If an explicit override becomes unavailable after scheduling, downstream skills still re-check executability and hard-stop clearly. No fallback to raw worktree Git is permitted.

### Apply the contract beyond `/ops-deliver`

The root reproduction is deliver, but process-level injection and shared skill wording intentionally cover other CLI-backed agent turns (`where`, `ship`, `merge`, `finish`, doctor/prune, and review preflight where applicable). Direct extension-owned `/ops-start` continues to call the same resolver and therefore shares precedence/version affinity.

Doctor distinguishes an invalid explicit override from a missing/corrupt package bin and updates remediation: repair/update the Pi package or set a valid explicit override; `npm link` remains optional for direct shell use.

## Risks / Trade-offs

- **Mutating `process.env` is session-global.** → Set only `OPENSPEC_OPS_BIN`, never overwrite an explicit value, and keep the value scoped to the Pi process and descendants.
- **Package-first precedence differs from the old PATH-first helper.** → Apply it only when a loaded package root is supplied; explicit env still wins, and tests cover version affinity.
- **Agent instructions are not mechanical enforcement.** → Pair visible binding with inherited process env and executable validation.
- **Executable checks differ across platforms.** → Centralize the check and test supported platforms; report a stable unavailable reason rather than spawning blindly.
- **Package bin may exist while its tsx fallback is broken.** → Add a lightweight executable probe or package-install integration test; runtime command failures remain clear JSON/tool errors and never trigger global installation.
- **Updating many full-text skills/prompts can drift.** → Add a consistency test over package-exported CLI-backed documents and keep shared wording generated/copied as one reviewed block.

## Migration Plan

1. Add detailed resolver/provenance and executable validation while retaining the string-returning compatibility API.
2. Inject/bind the runtime from the guided extension and gate `/ops-deliver` scheduling on availability.
3. Update CLI-backed skills/prompts and README/doctor guidance.
4. Verify git/path/npm package layouts without global link, including paths with spaces and explicit override/PATH precedence.
5. Existing users with valid `OPENSPEC_OPS_BIN` continue unchanged; users relying on PATH continue to work when no usable loaded package root is supplied.

Rollback removes session handoff/injection and returns to env/PATH-only agent behavior; it does not modify repositories, shell profiles, or package installation state.

## Open Questions

None. Remote binary acquisition and extension-disabled package discovery remain explicitly out of scope.
