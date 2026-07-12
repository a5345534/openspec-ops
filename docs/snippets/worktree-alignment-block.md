# Worktree alignment block (paste into **your** propose skill)

openspec-ops no longer ships or overrides `openspec-propose` / `opsx-propose`.
To keep OpenSpec change artifacts inside an openspec-ops worktree, paste the
block below into **your project's** propose skill or prompt (after
`openspec update` if needed).

Also consider:

- Pi extension hard path inject after **explicit** `/ops-start`
- Optional: `alias openspec=openspec-ops-intercept` + `OPENSPEC_REAL_BIN` (forward-only; does not auto-ensure)

```markdown
<!-- openspec-ops:worktree-alignment BEGIN -->
## openspec-ops worktree alignment

**start does NOT switch process cwd.** Bind cwd to the worktree path explicitly.

Once kebab-case change name `<name>` is known:

1. Resolve workspace:
   ```bash
   openspec-ops where "<name>" --json || openspec-ops start "<name>" --json
   ```
2. **Alignment required** when `openspec-ops` is resolvable AND a change worktree is in use (after start or where found):
   - On where/start hard failure: **STOP** and report the error. Do **not** treat primary-only scaffold as success.
   - On success: use `result.path` as **cwd** for ALL subsequent `openspec` CLI invocations and for creating/editing files under `openspec/changes/<name>/`.
3. **Alignment not required** when no change worktree exists OR `openspec-ops` cannot be resolved:
   - You MAY continue using the current directory, but MUST warn that worktree alignment is skipped.

There is **no** `OPENSPEC_OPS_AUTO_START` switch. Use explicit start + `/ops-next` for lifecycle.

**Submodules:** Path alignment does **not** create feature branches inside git submodules unless you pass `start --init-submodule-branches`. Check `result.submodules` from `where` — do not leave long-lived work on detached submodule HEAD.
<!-- openspec-ops:worktree-alignment END -->
```

## Apply (paste into **your** apply skill if desired)

```markdown
<!-- openspec-ops:worktree-alignment BEGIN -->
## openspec-ops worktree alignment (apply)

1. Prefer `openspec-ops where "<name>" --json` (or start if missing).
2. When a worktree path `W` is known, implement and run OpenSpec under `W`.
3. If no worktree: warn and only then continue on primary.
<!-- openspec-ops:worktree-alignment END -->
```
