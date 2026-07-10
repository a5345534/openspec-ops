# openspec-ops

OpenSpec 操作自动化层（旁路增强，不修改 OpenSpec 本体）。

## Intent

让 OpenSpec 的日常操作更自动化，同时保持与原版 OpenSpec 的兼容性。

- **不 fork / 不改** OpenSpec 本身
- **外挂** 在既有 OpenSpec 流程之上
- 先从 **worktree 相关自动化** 切入，再逐步扩展其他操作

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

### Auto-review (after propose)

After a successful ensure on slash-propose, the extension may inject a
review instruction so the agent runs **ops-review** on the new artifacts.

| `OPENSPEC_OPS_AUTO_REVIEW` | Behavior |
|---|---|
| `on` (default) | Auto-review inject after ensure-on-propose |
| `off` | No auto-review; use `/ops-review <change>` manually |

```bash
export OPENSPEC_OPS_AUTO_REVIEW=off
```

Note: review inject is currently coupled to slash `/opsx-propose` + successful ensure (not every propose path).

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
- If propose fails and no artifacts exist, auto-review skips gracefully.
- After auto-review runs once, it won't repeat on subsequent turns.

Reload Pi after pulling (`/reload`) so the extension is picked up from `.pi/extensions/`.

## Working principles

1. **兼容优先**：原版 OpenSpec 流程不被破坏
2. **旁路增强**：自动化能力以外挂方式提供
3. **小步验证**：先做 worktree 相关的最小可用自动化，再扩展
4. **可丢弃假设**：在证据不足前，不把临时设计写成硬契约
5. **独立演进**：本仓库自洽说明自身目标与边界

## Status

- Phase 0 CLI: archived `add-workspace-lifecycle-cli`
- Pi ops skills/prompts: archived `add-pi-ops-skills`
- Auto-ensure on propose: archived `add-pi-auto-ensure-on-propose`
- Auto-finish on archive (orphan reclaim): archived `add-pi-auto-finish-on-archive`

## License

待定。
