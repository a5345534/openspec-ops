# openspec-ops

OpenSpec 操作自动化层（旁路增强，不修改 OpenSpec 本体）。

## Intent

让 OpenSpec 的日常操作更自动化，同时保持与原版 OpenSpec 的兼容性。

- **不 fork / 不改** OpenSpec 本身
- **外挂** 在既有 OpenSpec 流程之上
- 先从 **worktree 相关自动化** 切入，再逐步扩展其他操作

## Recommended delivery loop

Default order (OpenSpec team-compatible; **merge before archive**):

```text
/ops-start <change>              # explicit worktree (no auto-ensure)
        │
/opsx-propose <change>           # plan artifacts in worktree W
        │
/ops-spec-review <change>        # full-review rounds; in-round fix verify
        │
/opsx-apply                      # implement in W
        │
/ops-ship <change>               # commit W + push + gh PR (no merge)
        │
/ops-impl-review <change>        # full-review rounds (or pick via /ops-next)
        │
/ops-merge <change>              # squash; checks green or empty; invoke=consent
        │
/opsx-archive                    # fold specs on mainline after merge
        │
/ops-finish <change>             # remove worktree; delete merged branches
                                 # (prune deprecated; --keep-branch to keep branch)

Between steps: /ops-next [change]  # guided menu (omit name → pick change)

**Batch path (after explore):** `/ops-deliver <change>` runs start→finish with **mandatory**
spec-review and impl-review; invoke **authorizes merge** when gates pass. Resume-safe.
Use `/ops-next` for single-step control instead.

Deliver lifecycle success means stations through **finish** completed for the change. It does **not**
mean the primary worktree was pulled to `origin/main` unless you pass opt-in finish sync flags
(default deliver does **not** pass them). See monorepo closeout checklist under Submodules.

```

- **ensure ≠ cwd** — skills/extension must use `where.path` explicitly ([snippet](docs/snippets/worktree-alignment-block.md)).
- **Package is pure sidecar** — ships `ops-*` skills only; does not replace project `openspec-*` / `opsx-*`.
- **Archive-before-merge** is not the default (risk of specs/code split).

**Archive on mainline after merge** when possible. Archiving only on a worktree while leaving `openspec/changes/<name>/` active on primary causes **split-brain** status and invites wrong-phase `/ops-spec-review` (pre-apply). Doctor reports `change_location_mismatch`. `/ops-spec-review` refuses archived-only changes unless you explicitly request historical re-review.


## Submodules (monorepos)

Parent change worktree branch **≠** nested submodule branch.

After `openspec-ops start`, git often leaves submodules on **detached HEAD** at the parent’s recorded SHA. Path alignment (write under the worktree) does **not** create a feature branch inside the submodule.

Recommended order when you implement inside a submodule:

1. `cd <worktree>/<submodule>` → `git switch -c <change>` (or an existing branch)
2. Commit in the submodule
3. In the parent worktree: `git add <submodule>` and commit the gitlink
4. Then PR/merge as usual; archive and `finish` after

`openspec-ops where --json` includes `result.submodules[]` (`path`, `detached`, `dirty`, `branch`, `head`).  
`openspec-ops doctor` reports `submodule_detached` (info) and `submodule_detached_dirty` (warning).  
Dirty `finish` messages mention submodule risk; openspec-ops never auto-commits submodules.

**Finish + submodules:** before `git worktree remove`, finish **deinits** initialized top-level submodules in the change worktree (`git submodule deinit -f -- <path>`), then removes the worktree (branch kept). Dirty trees still need commit/stash or `--force`. If teardown fails: error `submodule_teardown_failed` with a manual deinit hint.

### After deliver/finish: primary is not auto-updated

**GitHub merge success ≠ primary checkout already on latest `main`.**  
By design, `finish` does **not** `git pull` the primary worktree and does **not** re-init submodules on primary (avoids mutating the operator’s main checkout without consent).

Monorepo closeout checklist (manual):

```bash
cd <primary>
git switch main                    # or your default base
git pull --ff-only origin main
git submodule update --init --recursive
```

After `submodule update`, a submodule on **detached HEAD at the parent gitlink** is **normal Git** (the pin is the source of truth)—not a failed deliver. Local branch `main` inside the submodule may lag or diverge from that pin; do not force-push submodule `main` to “fix” it unless you intend a publish policy.

`openspec-ops doctor` can report:
- `primary_behind_origin` (warning) when primary lags local `origin/<base>`
- `primary_submodule_detached` (info) / `primary_submodule_detached_dirty` (warning) on primary

Optional finish flags (default **off**):

```bash
openspec-ops finish <change> --sync-primary          # clean primary only; ff-only pull
openspec-ops finish <change> --sync-submodules       # submodule update --init --recursive on primary
openspec-ops finish <change> --attach-submodule-main # only if pin == or ff from main; never force
```

Related: teardown / submodule **feature-branch** prune is separate (see issue #22); this checklist is the **return-to-main** DoD (issue #24).

## Phase 0: workspace lifecycle CLI

`openspec-ops` 提供 harness-neutral 的 git worktree 生命周期命令，对应官方 [team workflow](https://github.com/Fission-AI/OpenSpec/blob/main/docs/team-workflow.md) 左右两侧的 git 惯例，**中间的 `/opsx:*` 流程保持原样**。

```text
openspec-ops start <change>     # branch + worktree
        │
/opsx:propose  →  review  →  /opsx:apply
        │
openspec-ops ship <change>      # commit worktree + push + gh PR (no merge)
        │
/ops-impl-review <change>       # post-ship: specs/tasks/diff/tests; fix+push
        │
openspec-ops merge <change>     # squash merge when checks green
        │
/opsx-archive → finish
        │
/opsx:archive                   # 原版 OpenSpec
        │
openspec-ops finish <change>    # remove worktree (keep branch)
```

### Ship (commit + PR)

```bash
openspec-ops ship <change> --json
openspec-ops ship <change> -m "feat: ..." --title "..." --draft --json
```

- Stages **all** changes in the change worktree (`git add -A`), one commit.
- Default message: `ship(<change>): worktree`.
- Pushes to `origin` (or `--remote`) **without** `--force`.
- Opens/reuses a PR via **GitHub CLI `gh`** (`--backend gh`; pluggable later).
  Requires a `gh` that supports `gh pr create --json url,number` and `gh pr list --json`.
- Aborts if a top-level submodule is **detached and dirty**; clean detached warns and continues.
- If push succeeds but PR fails: fix `gh`/auth and **re-run ship** (clean tree → no new commit).
- Clean + fully synced + no PR range: may exit `nothing_to_ship` (exit 3).
- Ahead/behind detection uses local `origin/<branch>` (run `git fetch` if remotes look stale).
- Does **not** merge, archive, or remove the worktree. Finish still never commits.


### Install / run

```bash
npm install
npm run build          # optional; bin can also run via tsx in dev
npm test

# via package script
npm run openspec-ops -- start add-dark-mode --json

# via bin (after npm install; uses dist/ if built, else tsx)
./bin/openspec-ops --help
./bin/openspec-ops start add-dark-mode
```

Or link globally from this repo:

```bash
npm link
openspec-ops doctor --json
```

### Pi package install (path B)

Share this repo as a [Pi package](https://github.com/earendil-works/pi) so other machines/projects can load the extension, skills, and prompts via `pi install` / `pi update --extensions`.

```bash
# 1) Push this repo to GitHub (once)
# gh repo create openspec-ops --source=. --public --push

# 2) Install into user Pi settings (global)
pi install git:github.com/<you>/openspec-ops@main

# or pin a tag/commit (recommended for teams)
pi install git:github.com/<you>/openspec-ops@v0.1.0

# project-local install (writes .pi/settings.json)
pi install -l git:github.com/<you>/openspec-ops@main
```

Update installed package resources:

```bash
pi update --extensions
# or one package:
pi update --extension git:github.com/<you>/openspec-ops
```

**Pinned refs:** `pi update --extensions` reconciles the clone to the **configured** ref; it does **not** automatically move `@v0.1.0` to a newer tag. To upgrade:

```bash
pi install git:github.com/<you>/openspec-ops@v0.2.0
```

**CLI on PATH:** git package install runs `npm install` (often omit dev). Runtime uses `tsx` from `dependencies` when `dist/` is missing. For a global CLI:

```bash
# from the package clone or this repo
npm link
# or set OPENSPEC_OPS_BIN to the package's bin/openspec-ops
```

`package.json` declares a **pure sidecar** surface (ops-* only — does **not** replace consumer OpenSpec skills):

```json
"pi": {
  "extensions": [".pi/extensions/**/*.ts"],
  "skills": [".pi/skills/ops-*/SKILL.md"],
  "prompts": [".pi/prompts/ops-*.md"]
}
```

- **Ships:** `ops-start` / `ops-where` / `ops-finish` / `ops-doctor` / `ops-spec-review` / `ops-ship` / `ops-merge` / `ops-next` / `ops-deliver` + extension + CLI (`ops-prune` deprecated)
- **Does not ship (as package skills/prompts):** `openspec-*`, `opsx-*` — your project keeps its own from `openspec init` / `openspec update`
- Vendored upstream copies (if any) live under `vendor/openspec-pi-ref/` for reference only and are **not** in `pi.*`

Project checkout of this monorepo still has local files for development; **Pi package install** only loads the allowlisted paths above.

### Write path alignment (issue #1)

**ensure/start creates a worktree; it does not switch the agent process cwd.**

openspec-ops does **not** override your `openspec-propose` skill. Alignment uses:

1. **Pi extension** — after ensure, REQUIRED write path = worktree
2. **Opt-in intercept** — `openspec-ops-intercept` (forward-only; no ensure)
3. **Optional snippet** — paste into *your* propose skill: [`docs/snippets/worktree-alignment-block.md`](docs/snippets/worktree-alignment-block.md)

Rules when using the snippet / orchestration:

- After the change name is known: `openspec-ops where` / `start`
- Use `result.path` as cwd for `openspec` and `openspec/changes/<name>/` writes
- Worktree creation is **explicit** (`/ops-start`); propose does not auto-ensure
- Prefer writing change artifacts in the worktree after start

`openspec-ops doctor --json` can hint if your **project** propose skill lacks the optional marker block (not the package tree).

See also GitHub issue [#1](https://github.com/a5345534/openspec-ops/issues/1).

### OpenSpec CLI intercept (`openspec-ops-intercept`)

Optional **forward-only** wrapper around stock `openspec` (does **not** auto-ensure worktrees). Prefer explicit `/ops-start` before propose. Historical ensure-before-new-change behavior was removed:

1. `openspec-ops start <name>` (ensure worktree)
2. Run the **real** OpenSpec binary with cwd set to the worktree (when known)
3. Print a stderr hint with the worktree path (later agent commands are **not** forced into that cwd)

```bash
# resolve real openspec once
export OPENSPEC_REAL_BIN="$(command -v openspec)"

# put intercept first, or alias
alias openspec=openspec-ops-intercept
# or: export PATH="/path/to/openspec-ops/bin:$PATH"  # only if intercept is named carefully

# disable ensure side effects
export OPENSPEC_OPS_INTERCEPT_NEW_CHANGE=off
```

| Env | Default | Meaning |
|---|---|---|
| `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE` | `on` | `on` = ensure then forward; `off` = pure forward |
| `OPENSPEC_REAL_BIN` | (PATH) | Absolute path to real `@fission-ai/openspec` binary |
| `OPENSPEC_OPS_BIN` | (PATH) | openspec-ops CLI for start |

Package.json registers **`openspec-ops-intercept`** only (does **not** replace global `openspec`).

After each lifecycle step, use **`/ops-next [change]` (omit name to pick among candidates)** to pick the next action (UI select or text menu). No auto-review / auto-ensure / auto-finish / auto-impl-review.

### Commands

| Command | Purpose |
|---|---|
| `start <change> [--init-submodule-branches]` | Create or reuse worktree at `<primary>/.worktrees/<change>` on branch `<change>` |
| `where <change>` | Print workspace path (strict: exit 5 if missing); includes `submodules[]` |
| `ship <change>` | Commit entire worktree, push branch, open/reuse PR via `gh` (no merge/force) |
| `merge <change>` | Merge open PR via `gh` (default squash; non-empty checks must pass; empty checks allowed by default; no chain) |
| `finish <change>` | Remove worktree; if PR **merged**, delete local+remote branch (unless `--keep-branch`). Deinits submodules. Dirty → `--force` |
| `prune <change>` | **Deprecated** — prefer finish; branch-only if no worktree + merged |
| `doctor` | Read-only health report (stale dirs, submodules, change_location_mismatch, …) |

Common flags:

- `--json` — stable envelope (`schemaVersion: 1`)
- `--repo <path>` — operate on a specific repo
- `--path` / `--branch` / `--base` — overrides for `start` (and path/branch for where/finish/ship)
- `--force` — `finish` only
- ship also: `-m/--message`, `--title`, `--body`, `--draft`, `--remote`, `--backend`

Defaults:

- `branch` = `<change>`
- `path` = `<primary-worktree>/.worktrees/<change>`
- `base` (new branch only) = `origin/HEAD` → local `main`/`master`

### Exit codes

| Code | Meaning |
|---|---|
| 0 | success (including idempotent reuse; doctor with issues) |
| 1 | usage / invalid change name |
| 2 | not a git repo / base unresolved |
| 3 | conflicts (path/branch busy/mismatch) |
| 4 | worktree dirty |
| 5 | not found |
| 10 | git/internal failure |

### Non-goals (Phase 0)

- 不包装 / 不替换 `/opsx:propose|apply|archive`
- 不自动 `commit` / `push` / 开 PR / merge
- 不调用 OpenSpec CLI，不因缺少 `openspec/changes/<name>` 而失败
- 不依赖 Orca 或其他 IDE
- 不默认嵌套 worktree、不写 sidecar 绑定文件、不提供短命令 `ops`

## Pi skills / prompts (ops-*)

This repo ships **project-local** Pi assets that orchestrate the CLI (they do not reimplement git):

| Slash / skill | CLI / function |
|---|---|
| `/ops-start` · `ops-start` | `openspec-ops start` |
| `/ops-where` · `ops-where` | `openspec-ops where` |
| `/ops-ship` · `ops-ship` | `openspec-ops ship` (commit+push+gh PR; no merge) |
| `/ops-impl-review` · `ops-impl-review` | Post-ship impl full-review rounds (fix+push in-round; choose via /ops-next) |
| `/ops-deliver` · `ops-deliver` | Batch start→finish after explore (reviews required; merge on invoke); **extension-only slash** (no prompt template; binds change name) |
| `/ops-merge` · `ops-merge` | Merge PR via `openspec-ops merge` (squash; fail/pending block; empty checks allow by default) |
| `/ops-finish` · `ops-finish` | `openspec-ops finish` (wt + merged branch cleanup) |
| `/ops-prune` · `ops-prune` | Deprecated; prefer finish |
| `/ops-doctor` · `ops-doctor` | `openspec-ops doctor` |
| `/ops-spec-review` · `ops-spec-review` | Iterative plan/spec review-fix (agent-driven; edits artifacts) |
| `/ops-config` | Session settings (e.g. `spec-review.max-rounds`; not a project file) |

Typical loop in Pi:

```text
/ops-start <change>      # when you want a worktree (explicit)
/opsx-propose <change>   # no auto-ensure
        │
/ops-spec-review <change>  # iterative plan/spec review-fix
        │
/opsx-apply
        │
/ops-ship <change>       # commit worktree + push + PR (requires gh; no merge)
        │
/ops-impl-review <change> # post-ship quality (choose via /ops-next)
/ops-next [change]        # guided next step (omit name → pick change)
        │
/ops-merge <change>      # only when user asks; checks green
        │
/opsx-archive → /ops-finish  # finish cleans wt + merged branches
```

### Prune (deprecated)

```bash
openspec-ops prune <change> --json
```

- Requires **no** registered worktree (run `finish` first).
- Requires a **merged** PR for head = change branch (`gh pr list --state merged`).
- Deletes **local** (`git branch -d` only, never `-D`) and **remote** (`git push --delete`).
- Remote already gone (e.g. GitHub auto-delete head branches) → still success.
- If squash merge makes `-d` fail: error with guidance; manual `-D` is operator choice.
- Complementary: GitHub repo setting “Automatically delete head branches” for remotes.


Manual workspace entry (advanced): `/ops-start <change>` or CLI `openspec-ops start`.

Requirements for the agent / extension:

- `openspec-ops` on `PATH`, or set `OPENSPEC_OPS_BIN` to the binary
- Skills/prompts and the Pi extension call `openspec-ops … --json` (`schemaVersion: 1`)

**Full-text self-contained:** each of the 5 skills and 5 prompts embeds the full runtime rules (not short forwarders). When CLI contract text changes, update all relevant files together.

**Not OpenSpec:** `ops-*` never replaces `opsx-*`. `/ops-finish` removes a worktree only; archive remains `/opsx-archive`.

Optional: symlink these skills into `~/.pi/agent/skills/` for other repos; prefer keeping CLI and skill versions aligned.

## Pi session config (`/ops-config`)

Session-only settings (not a project config file; reset when Pi restarts).

```text
/ops-config show
/ops-config set spec-review.max-rounds 5
/ops-config get spec-review.max-rounds
/ops-config unset spec-review.max-rounds
/ops-config reset
```

Precedence: **session > env > default**.  
`spec-review.max-rounds` default **3** (env: `OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS`).
`impl-review.max-rounds` default **3** (env: `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS`).

### Auto impl-review after ship

After ship, use `/ops-next` to choose impl-review / re-ship / merge. Impl-review is **not** auto-started. Does **not** merge.


## Pi extension: guided lifecycle

### Retired auto capabilities (no runtime)

| Former capability | Use instead |
|---|---|
| `pi-auto-ensure-on-propose` / `OPENSPEC_OPS_AUTO_START` | `/ops-start` |
| `pi-auto-review-follow-up` / `OPENSPEC_OPS_AUTO_REVIEW` | `/ops-next` or `/ops-spec-review` |
| `pi-auto-impl-review-follow-up` / `OPENSPEC_OPS_AUTO_IMPL_REVIEW` | `/ops-next` or `/ops-impl-review` |
| `pi-auto-finish-on-archive` / `OPENSPEC_OPS_AUTO_FINISH` | `/ops-next` or `/ops-finish` |
| *(batch path, not auto)* | `/ops-deliver` start→finish after explore |



Extension: `.pi/extensions/openspec-ops-guided.ts` (guided lifecycle).

- **`/ops-start`** — manual worktree only  
- **`/ops-next [change]`** — hard-coded next-step menu (`ctx.ui.select` or text; never auto-picks)
- **`/ops-deliver <change>`** — batch start→finish after explore (reviews required; merge consent on invoke); extension binds slash args then skill follow-up  
- **`/ops-config`** — session max-rounds for reviews  
- **`/ops-metrics`** — local opt-in model/cost, review-round, and deliver-reliability metrics (no LLM/report turn)

**Removed:** auto-ensure on propose, auto-review settle fire, auto-finish, auto-impl-review after ship, intercept ensure-before-new-change.

Stations (main menu): `no_workspace`→start; `proposed`→spec-review|apply; `applied`→ship; `shipped`→impl-review|ship|merge; `merged`→archive; `archived`→finish.

## Local lifecycle metrics (`/ops-metrics`)

Disabled by default. Collection and reports are mechanical: they do **not** call a model, queue a follow-up, expose a telemetry tool, or alter lifecycle gates.

```text
/ops-metrics status
/ops-metrics on
/ops-metrics report [change]        # authoritative JSONL source
/ops-metrics export [change]
/ops-metrics off                    # keeps existing data
/ops-metrics reset confirm          # deletes JSONL only
```

Records live under the Pi agent directory (`~/.pi/agent/openspec-ops/metrics/`, respecting `PI_CODING_AGENT_DIR`) as per-session JSONL. New records have a unique record ID and a hashed machine-local primary-repository ID; absolute workspace paths are not recorded, linked worktrees share one ID, and unresolved/legacy workspace identity stays unknown. Only metadata is stored: change/action/round, model and raw usage/cache/cost, structured review counts/verdict, and deliver outcomes/error codes. Prompt/assistant prose, source, tool inputs/results, stderr, and secrets are not persisted; nothing is uploaded.

### Optional local SQLite projection

JSONL remains the append-only source of truth. SQLite is never created or written by metrics enablement, model turns, ordinary reports, or package updates. On a Node runtime that provides `node:sqlite`, an operator may explicitly create/attach and synchronize a rebuildable local projection:

```text
/ops-metrics db status
/ops-metrics db init                              # default: <agentDir>/openspec-ops/metrics.sqlite3
/ops-metrics db init /absolute/local/metrics.db   # spaces are accepted as the remaining path
/ops-metrics db sync                              # idempotent full JSONL scan
/ops-metrics report --source sqlite [change]      # does not implicitly sync
/ops-metrics db rebuild confirm                   # clears DB projection, re-ingests JSONL
/ops-metrics db detach                            # keeps the DB file
/ops-metrics db destroy confirm                   # deletes only compatible configured DB + sidecars
```

A runtime without `node:sqlite` reports the DB feature unavailable while JSONL collection/reporting continues. SQLite configuration is independent from metrics on/off; JSON reset never modifies the database, and detach/destroy never modifies JSONL. The reserved `.jsonl` suffix is rejected for database paths so a projection cannot collide with session source files. Use a local filesystem—concurrent direct writes to one SQLite file over NFS/SMB/cloud-synced folders are unsupported. The projection makes no network or model call and DB failures cannot block lifecycle work.

Reports answer:

- **A — model/cost/cache:** usage by action/model plus attribution coverage
- **B — review rounds:** cost, new-major rate, ready rate, and missing result markers per round
- **C — deliver reliability:** attempts, first-invocation completion, resumes, needs-human/incomplete, hard stops

Because `/ops-deliver` remains skill-orchestrated, hidden metadata-only skill markers provide some child-stage attribution. Missing/invalid markers stay in `unknown`; reports never use another model to guess. Metrics/storage failures are fail-open and cannot block start/review/apply/ship/merge/archive/finish.

## License

待定。
