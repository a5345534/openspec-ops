## 1. Project scaffold

- [x] 1.1 Initialize Node/TypeScript package (`package.json`, `tsconfig.json`, test runner) with bin name `openspec-ops`
- [x] 1.2 Add `bin/openspec-ops` entry that dispatches to the CLI module
- [x] 1.3 Create source layout: `src/cli.ts`, `src/git.ts`, `src/resolve.ts`, `src/types.ts`, `src/commands/{start,where,finish,doctor}.ts`
- [x] 1.4 Add `.gitignore` suitable for Node (and ignore any local test temp dirs)

## 2. Shared primitives

- [x] 2.1 Implement change-name validation (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) and shared argv parsing (`--json`, `--repo`, `--path`, `--branch`, `--base`, `--force`)
- [x] 2.2 Implement git helpers: run git, `worktree list --porcelain` parse, status porcelain dirty check, branch exists / checked-out path
- [x] 2.3 Implement resolution: repo discovery, primary path, default path/branch, base ref order (`--base` → `origin/HEAD` → `main`/`master`)
- [x] 2.4 Implement JSON envelope helpers (`schemaVersion: 1`, ok/result and ok/error.details) and human last-line path printing
- [x] 2.5 Map error codes to exit codes `1|2|3|4|5|10` consistently

## 3. Commands

- [x] 3.1 Implement `start`: create/reuse worktree per conflict matrix; never move primary HEAD; report `action` created|reused and `changeDirExists`
- [x] 3.2 Implement `where`: path-then-branch discovery; strict `not_found` (exit 5); dirty flag; `matchedBy`
- [x] 3.3 Implement `finish`: resolve workspace, refuse dirty without `--force`, remove worktree, keep branch, report `branchDeleted: false`
- [x] 3.4 Implement `doctor`: `worktrees[]` inventory, issues `stale_worktree_dir` / `missing_worktree_path` / `worktree_without_change_dir`, exit 0 when checks run

## 4. Tests (contract scenarios)

- [x] 4.1 Build temp-git fixture helper (init repo, initial commit on main, optional second worktree)
- [x] 4.2 Test S1 happy path: start → start reuse → where clean → finish → where not_found
- [x] 4.3 Test S2 reuse existing free branch without resetting tip
- [x] 4.4 Test S3 branch_busy and S4 path_not_worktree
- [x] 4.5 Test S5 dirty finish refused and `--force` success
- [x] 4.6 Test S6 start from inside a linked worktree anchors under primary `.worktrees/`
- [x] 4.7 Test S7 not_a_git_repo for start/where/finish/doctor
- [x] 4.8 Test invalid change name, JSON envelopes, and exit codes for not_found / conflicts
- [x] 4.9 Test doctor reports stale dir under `.worktrees/` with exit 0

## 5. Docs and wiring

- [x] 5.1 Update root `README.md` with install/run instructions, command summary, and official loop mapping (`start` → `/opsx:*` → `finish`)
- [x] 5.2 Document non-goals (no OpenSpec wrapping, no commit/PR/archive, no Orca requirement)
- [x] 5.3 Add npm script(s) e.g. `test`, and verify `openspec-ops --help` works via package bin

## 6. Verification

- [x] 6.1 Run full test suite and fix failures
- [x] 6.2 Manual smoke on a real external repo: start, where, finish, doctor
- [x] 6.3 Confirm no code path invokes `openspec` CLI or mutates `openspec/changes` for success paths
