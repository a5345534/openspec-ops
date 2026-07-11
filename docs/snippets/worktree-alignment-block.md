# Worktree alignment block (paste into **your** propose skill)

openspec-ops no longer ships or overrides `openspec-propose` / `opsx-propose`.
To keep OpenSpec change artifacts inside an openspec-ops worktree, paste the
block below into **your project's** propose skill or prompt (after
`openspec update` if needed).

Also consider:

- Pi extension hard path inject after ensure
- Opt-in: `alias openspec=openspec-ops-intercept` + `OPENSPEC_REAL_BIN`

```markdown
<!-- openspec-ops:worktree-alignment BEGIN -->
## openspec-ops worktree alignment

**ensure/start does NOT switch process cwd.** Bind cwd to the worktree path explicitly.

Once kebab-case change name `<name>` is known:

1. Resolve workspace:
   ```bash
   openspec-ops where "<name>" --json || openspec-ops start "<name>" --json
   ```
2. **Alignment required** when `openspec-ops` is resolvable AND `OPENSPEC_OPS_AUTO_START` is not `off`:
   - On where/start hard failure: **STOP** and report the error. Do **not** treat primary-only scaffold as success.
   - On success: use `result.path` as **cwd** for ALL subsequent `openspec` CLI invocations and for creating/editing files under `openspec/changes/<name>/`.
3. **Alignment not required** when `OPENSPEC_OPS_AUTO_START=off` OR `openspec-ops` cannot be resolved:
   - You MAY continue using the current directory, but MUST warn that worktree alignment is skipped.

Tip: `alias openspec=openspec-ops-intercept` with `OPENSPEC_REAL_BIN` set so `openspec new change` ensures before scaffold.
<!-- openspec-ops:worktree-alignment END -->
```

## Apply (paste into **your** apply skill if desired)

```markdown
<!-- openspec-ops:worktree-alignment BEGIN -->
## openspec-ops worktree alignment (apply)

Once change name `<name>` is known:

1. `openspec-ops where "<name>" --json` (or `start` if missing)
2. On success: use `result.path` as **cwd** for implementation edits and OpenSpec CLI for that change.
3. If alignment required and where/start fails: STOP rather than implementing only on primary by accident.

**ensure/start does NOT switch process cwd.**

Default delivery order: **merge → archive → finish** (ship/PR is separate; openspec-ops does not auto-merge).
<!-- openspec-ops:worktree-alignment END -->
```
