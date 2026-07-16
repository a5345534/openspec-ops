## 1. Remote and Backend Preflight

- [x] 1.1 Add stable destination and push error codes with mutation-fact details.
- [x] 1.2 Resolve the requested Git remote's effective push URL (including pushurl overrides) and fail before commit when it is absent.
- [x] 1.3 Add synchronous PR-backend preflight and GitHub URL parsing, gh authentication, and repository lookup.
- [x] 1.4 Run all preflight checks before staging or committing while preserving successful ship behavior.

## 2. Push Failure Classification

- [x] 2.1 Classify push authentication, remote rejection, and other push failures without generic `git_failed`.
- [x] 2.2 Include remote, branch, commit-created/SHA, push-attempted, and push-success status in structured failure details.
- [x] 2.3 Preserve clean rerun behavior without duplicate commits.

## 3. Tests and Documentation

- [x] 3.1 Cover a real local repository with no remote and prove no ship commit is created.
- [x] 3.2 Cover unsupported URLs, gh auth failure, nonexistent GitHub repository, successful preflight, and push classifications.
- [x] 3.3 Document explicit remediation, first-push history exposure, and no implicit repository creation.
- [x] 3.4 Run OpenSpec validation, typecheck, build, targeted tests, full tests, and diff checks.
