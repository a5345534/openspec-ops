## Context

`runShip` currently probes submodules and immediately creates a commit when the worktree is dirty. Remote existence is discovered indirectly by `branchAheadOfRemote`, which treats every missing remote-tracking ref as “needs push”; the first authoritative remote check is therefore the mutating push. The `gh` backend is not resolved until after that push.

Issue #35 requires errors that identify destination readiness before commit creation where possible, while preserving retryability for failures that can only occur during push. Repository creation has broader privacy and consent implications and is excluded.

## Goals / Non-Goals

**Goals:**

- Validate configured remote identity and the selected PR backend before staging or committing.
- Distinguish missing/invalid remote, GitHub auth, nonexistent repository, and push rejection/failure.
- Report whether commit and push mutations occurred on every new failure path.
- Keep the successful ship sequence and schema version unchanged.

**Non-Goals:**

- Create or change remotes or GitHub repositories.
- Guess owner, repository name, or visibility.
- Prove that a future push will succeed after preflight.
- Inspect or rewrite repository history.

## Decisions

### Split Git remote and PR-backend checks

Ship orchestration will resolve the requested remote's effective push URL with `git remote get-url --push <remote>`, so an explicit `remote.<name>.pushurl` takes precedence over its fetch URL exactly as Git push does. A missing remote or unusable empty push URL yields `remote_not_configured` before mutation. The selected PR backend then preflights that push URL. For `gh`, only canonical GitHub HTTPS/SSH URL forms are accepted and converted to `owner/repo`; malformed or non-GitHub URLs yield `remote_invalid`.

The backend interface gains a synchronous preflight method so destination-specific behavior stays out of the ship command and future backends can implement their own checks.

### Use authenticated gh repository lookup

The `gh` backend will run `gh --version`, `gh auth status`, then `gh repo view <owner/repo> --json nameWithOwner`. Failures map to `pr_backend_unavailable`, `github_auth_failed`, `github_repository_not_found`, or `github_repository_unavailable`. This is read-only and runs before commit creation.

### Classify push failures separately

A successful preflight cannot prevent branch protection, non-fast-forward, credential-helper differences, or network changes. Push errors will be classified as `push_auth_failed`, `push_rejected`, or `push_failed`. Error details include remote, branch, `commitCreated`, optional `commitSha`, and `pushOk: false`. Preflight errors always report `commitCreated: false` and `pushOk: false`.

### Keep bootstrap separate

No flag or command creates a GitHub repository in this change. Guidance will tell the operator to configure/create the destination explicitly and warn that a first push publishes all reachable history. A future bootstrap command requires its own consent, ownership, visibility, and history-review design.

## Risks / Trade-offs

- [Preflight adds network/gh latency to every gh ship] → Checks are bounded synchronous CLI calls and prevent more costly post-commit failures.
- [gh auth can pass while Git push credentials later fail] → Keep a distinct `push_auth_failed` classification with mutation facts.
- [GitHub Enterprise/custom hosts are rejected initially] → Fail clearly as `remote_invalid`; broaden host configuration in a separate design.
- [Repository visibility can hide existence from unauthenticated users] → Authentication is checked first; unresolved authenticated lookup maps to not-found without guessing.
