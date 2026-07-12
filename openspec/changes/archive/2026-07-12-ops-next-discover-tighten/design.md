# Design: ops-next-discover-tighten

## Bug

```ts
const leaf = basename(root);
if (CHANGE_NAME_RE.test(leaf)) found.add(leaf);
```

When `root` is `.../openspec-ops` (package or Pi git clone), **`openspec-ops` is always a candidate**.

## Fix rules

```text
for each root:
  + openspec/changes/<kebab>/  (skip archive, skip non-dirs)
  + .worktrees/<kebab>/        (dirs only; kebab or inferChangeFromLeaf)
  − DO NOT add basename(root) unless root is itself under a .worktrees/ parent
```

Optional hard excludes:

- name === `openspec-ops` when root path ends with `/openspec-ops` and is not `.../.worktrees/openspec-ops`
- basename equals package.json `name` field when root is package root (heavier; path heuristic enough for v1)

## Worktree leaf detection

Accept `.worktrees/<name>` if:

- directory exists, and
- name is kebab (CHANGE_NAME_RE) or inferChangeFromLeaf returns kebab

Do **not** require `git worktree list` for v1 (tests stay FS-only).

## cwd worktree case

If operator cwd is `.../.worktrees/my-change`, we still want `my-change`:

- Covered by: when iterating roots, if `root` matches `*/.worktrees/<leaf>`, add `<leaf>`
- Or: if `basename(dirname(root)) === '.worktrees'`, add basename(root)

```ts
function maybeWorktreeLeaf(dir: string): string | null {
  const parent = basename(dirname(dir));
  if (parent === ".worktrees") {
    const leaf = basename(dir);
    if (CHANGE_NAME_RE.test(leaf)) return leaf;
    return inferChangeFromLeaf(leaf);
  }
  return null;
}
```

Use this instead of blind basename(root).

## Tests

| Case | Expect |
|---|---|
| root = fake package `.../openspec-ops` with no changes | `[]` |
| + `openspec/changes/add-x` | `["add-x"]` |
| + `.worktrees/ship-y` | includes `ship-y` |
| root = `.../.worktrees/add-x` as sole root | `["add-x"]` |
| archive only under changes | not listed |

## Stale active dirs

Not auto-deleted. Discovery correctly lists them if present; operators archive/finish hygiene is separate (doctor already has related checks).
