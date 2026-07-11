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
openspec-ops start / auto-ensure / intercept
        │
/opsx-propose          plan artifacts in worktree W
        │
/ops-review            optional plan quality gate
        │
/opsx-apply            implement in W (extension binds path when name known)
        │
git commit + PR        (future: ops-ship — not in core finish)
        │
review + merge → main
        │
/opsx-archive          fold specs; default on mainline checkout after merge
        │
openspec-ops finish    remove worktree when clean (never auto --force if dirty;
                       never commit/merge)
```

- **ensure ≠ cwd** — skills/extension must use `where.path` explicitly ([snippet](docs/snippets/worktree-alignment-block.md)).
- **Package is pure sidecar** — ships `ops-*` skills only; does not replace project `openspec-*` / `opsx-*`.
- **Archive-before-merge** is not the default (risk of specs/code split).

## Phase 0: workspace lifecycle CLI

`openspec-ops` 提供 harness-neutral 的 git worktree 生命周期命令，对应官方 [team workflow](https://github.com/Fission-AI/OpenSpec/blob/main/docs/team-workflow.md) 左右两侧的 git 惯例，**中间的 `/opsx:*` 流程保持原样**。

```text
openspec-ops start <change>     # branch + worktree
        │
/opsx:propose  →  review  →  /opsx:apply
        │
git commit && PR → merge
        │
/opsx:archive                   # 原版 OpenSpec
        │
openspec-ops finish <change>    # remove worktree (keep branch)
```

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

- **Ships:** `ops-start` / `ops-where` / `ops-finish` / `ops-doctor` / `ops-review` + extension + CLI
- **Does not ship (as package skills/prompts):** `openspec-*`, `opsx-*` — your project keeps its own from `openspec init` / `openspec update`
- Vendored upstream copies (if any) live under `vendor/openspec-pi-ref/` for reference only and are **not** in `pi.*`

Project checkout of this monorepo still has local files for development; **Pi package install** only loads the allowlisted paths above.

### Write path alignment (issue #1)

**ensure/start creates a worktree; it does not switch the agent process cwd.**

openspec-ops does **not** override your `openspec-propose` skill. Alignment uses:

1. **Pi extension** — after ensure, REQUIRED write path = worktree
2. **Opt-in intercept** — `openspec-ops-intercept` on `openspec new change`
3. **Optional snippet** — paste into *your* propose skill: [`docs/snippets/worktree-alignment-block.md`](docs/snippets/worktree-alignment-block.md)

Rules when using the snippet / orchestration:

- After the change name is known: `openspec-ops where` / `start`
- Use `result.path` as cwd for `openspec` and `openspec/changes/<name>/` writes
- **Fail-closed** when `openspec-ops` is resolvable and `OPENSPEC_OPS_AUTO_START` is not `off` and where/start fails
- **`OPENSPEC_OPS_AUTO_START=off`** (or ops missing): primary allowed **with warning**

`openspec-ops doctor --json` can hint if your **project** propose skill lacks the optional marker block (not the package tree).

See also GitHub issue [#1](https://github.com/a5345534/openspec-ops/issues/1).

### OpenSpec CLI intercept (`openspec-ops-intercept`)

Agents usually run `openspec new change <name>` after `/opsx-propose` **without** a name on the slash line. This package ships an **opt-in** wrapper that intercepts that CLI call **before** the change directory is created:

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

Auto-review follow-up no longer requires a slash change name: when the Pi extension is loaded, settle-time discovery schedules `/ops-review <change>` when `proposal.md` appears.

### Commands

| Command | Purpose |
|---|---|
| `start <change>` | Create or reuse worktree at `<primary>/.worktrees/<change>` on branch `<change>` |
| `where <change>` | Print workspace path (strict: exit 5 if missing) |
| `finish <change>` | Remove worktree; **keeps branch**. Dirty requires `--force` |
| `doctor` | Read-only health report (stale dirs, missing paths, …) |

Common flags:

- `--json` — stable envelope (`schemaVersion: 1`)
- `--repo <path>` — operate on a specific repo
- `--path` / `--branch` / `--base` — overrides for `start` (and path/branch for where/finish)
- `--force` — `finish` only

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
| `/ops-finish` · `ops-finish` | `openspec-ops finish` |
| `/ops-doctor` · `ops-doctor` | `openspec-ops doctor` |
| `/ops-review` · `ops-review` | Read & analyze artifacts (agent-driven, no new CLI) |

Typical loop in Pi:

```text
/opsx-propose <change>   # harness may auto-ensure worktree first (see below)
        │
/ops-review <change>     # optional quality gate (new, see ops-review skill)
        │
/opsx-apply → (/opsx-archive)   # original OpenSpec
        │
/ops-finish <change>     # optional cleanup; not archive
                         # (Pi may also auto-reclaim orphan worktrees — see below)
```

Manual workspace entry (advanced): `/ops-start <change>` or CLI `openspec-ops start`.

Requirements for the agent / extension:

- `openspec-ops` on `PATH`, or set `OPENSPEC_OPS_BIN` to the binary
- Skills/prompts and the auto-ensure extension always call `openspec-ops … --json` (`schemaVersion: 1`)

**Full-text self-contained:** each of the 5 skills and 5 prompts embeds the full runtime rules (not short forwarders). When CLI contract text changes, update all relevant files together.

**Not OpenSpec:** `ops-*` never replaces `opsx-*`. `/ops-finish` removes a worktree only; archive remains `/opsx-archive`.

Optional: symlink these skills into `~/.pi/agent/skills/` for other repos; prefer keeping CLI and skill versions aligned.

## Pi extension: auto-ensure + auto-review + auto-finish

Project extension: `.pi/extensions/openspec-ops-auto-ensure.ts`

The extension provides harness gates (CLI side effects; OpenSpec prompts unchanged):

### Auto-ensure (before propose)

When you type `/opsx-propose <kebab-change>` (or `/opsx:propose …`):

1. Detects propose intent (slash strong signal only)
2. Ensures a worktree via `openspec-ops where` / `start --json` (idempotent)
3. **Releases** the original input so stock `/opsx-propose` expands unchanged

| `OPENSPEC_OPS_AUTO_START` | Behavior |
|---|---|
| `on` (default) | Silent ensure before propose |
| `ask` | Confirm only if worktree is missing |
| `off` | No ensure; native OpenSpec only |

```bash
# disable auto-ensure
export OPENSPEC_OPS_AUTO_START=off
```

### Auto-review (follow-up turn after propose)

Schedules a **new agent turn** to run **ops-review** when propose artifacts are ready—not a same-turn side note, and not a mechanical review CLI.

1. **Watch arm** (v1): `/opsx-propose <kebab-name>` (or `/opsx:propose …`) with parseable name and policy `on` → sticky review watch (**independent of ensure success**; still arms when `AUTO_START=off` / ensure skipped)
2. **Ensure hard-abort** (missing bin / conflict `handled`): clears that review watch (no zombie)
3. **Check points**: each `agent_settled` while review watches exist
4. **Readiness (v1):** `openspec/changes/<change>/proposal.md` exists (project root, cwd, and/or active workspace path)
5. When ready → clear watch → `sendUserMessage("/ops-review <change>", { deliverAs: "followUp" })` → new turn expands ops-review
6. When not ready → keep watch (multi-turn propose safe)

| `OPENSPEC_OPS_AUTO_REVIEW` | Behavior |
|---|---|
| `on` (default) | Arm on slash-propose + follow-up `/ops-review` when ready |
| `off` | No arm; use `/ops-review <change>` manually |

```bash
export OPENSPEC_OPS_AUTO_REVIEW=off
```

- Review body remains the **ops-review** skill/prompt (LLM). No `openspec-ops review` CLI.
- v1 requires kebab change name on the propose slash to arm (skill-path propose is not detected).

### Auto-finish (orphan worktree reclaim)

User language: "after archive, clean up the worktree."  
Technical: **reclaim orphan worktrees when a watched change is no longer active** — not when `/opsx-archive` is merely typed.

1. **Watch arm** (v1): `/opsx-archive <kebab-name>` (or `/opsx:archive …`) with a parseable name and policy not `off` → sticky watch (optional: skip arm if `where` already not_found). **Never** runs `finish` on input. Archive input is always released (fail-open).
2. **Check points**: each `agent_settled` while watches exist → `openspec-ops where --json`
3. **Orphan hard conditions** (all required before finish):
   - worktree still exists
   - `dirty === false`
   - `changeDirExists === false` (change no longer active)
4. While change still active → keep watch, no finish (multi-turn archive safe)
5. When orphan + clean → policy path; **never** `--force`

| `OPENSPEC_OPS_AUTO_FINISH` | Behavior |
|---|---|
| `ask` (default) | Confirm, then `openspec-ops finish` (no UI → skip, no silent finish) |
| `on` | Finish without confirm when orphan hard conditions hold |
| `off` | No watch / no reclaim |

```bash
export OPENSPEC_OPS_AUTO_FINISH=off   # disable
export OPENSPEC_OPS_AUTO_FINISH=on    # aggressive clean reclaim
```

- Finish keeps the **branch**; it is **not** OpenSpec archive.
- Manual fallback (any harness): `/ops-finish` or `openspec-ops finish` — skills are not the Pi automation main path.
- Dirty orphan: notify and clear watch; use manual finish if you need `--force` with consent.
- v1 requires kebab change name on the archive slash to arm a watch.

### Error handling

- If ensure fails (e.g. `branch_busy`), propose does **not** continue; the error code is shown.
- Archive path is **fail-open**: missing CLI / finish errors never cancel archive.
- Auto-review fires at most once per arm (watch cleared when follow-up is scheduled).
- If `proposal.md` never appears, the review watch stays until policy off or a later ready settle; ensure abort clears the watch.

Reload Pi after pulling (`/reload`) so the extension is picked up from `.pi/extensions/`.

## Working principles

1. **兼容优先**：原版 OpenSpec 流程不被破坏
2. **旁路增强**：自动化能力以外挂方式提供
3. **小步验证**：先做 worktree 相关的最小可用自动化，再扩展
4. **可丢弃假设**：在证据不足前，不把临时设计写成硬契约
5. **独立演进**：本仓库自洽说明自身目标与边界

## Status

- Pi package ops-only surface: archived `package-ops-only-surface`

- Worktree write alignment (issue #1): archived `align-propose-writes-with-worktree`

- OpenSpec CLI intercept (`openspec-ops-intercept`): archived `intercept-openspec-new-change`

- Phase 0 CLI: archived `add-workspace-lifecycle-cli`
- Pi ops skills/prompts: archived `add-pi-ops-skills`
- Auto-ensure on propose: archived `add-pi-auto-ensure-on-propose`
- Auto-finish on archive (orphan reclaim): archived `add-pi-auto-finish-on-archive`
- Auto-review follow-up turn: archived `rebind-auto-review-follow-up-turn`

## License

待定。
