## Why

A local-only repository can reach `ship`, receive a new commit, and only then fail at `git push` with generic `git_failed`. Ship needs a non-mutating remote and GitHub readiness gate so operators receive actionable errors before commit creation whenever the destination itself is known to be unusable.

## What Changes

- Preflight the requested remote before staging or committing: configured effective push URL, GitHub-compatible identity for the `gh` backend, authenticated `gh`, and repository existence.
- Return stable structured errors for missing/invalid remotes, GitHub authentication failure, nonexistent GitHub repositories, and later push rejection/failure.
- Include mutation facts (`commitCreated`, commit SHA when applicable, and `pushOk`) in ship error details.
- Preserve existing successful configured-remote ship behavior and safe re-runs.
- Document first-push history exposure and manual remediation.
- Do not create GitHub repositories automatically; explicit repository bootstrap remains a separate future capability.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `ops-ship`: Add a pre-commit remote/GitHub readiness gate and mutation-aware structured failures.

## Impact

Affected code includes ship orchestration, Git/GitHub backend preflight helpers, error taxonomy, tests, and ship documentation. The JSON envelope remains schema version 1; new error codes and details are additive. No repository creation, force push, merge, archive, or finish behavior is added.
