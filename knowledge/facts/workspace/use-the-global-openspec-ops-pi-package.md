---
name: "Use the global openspec-ops Pi package"
description: "openspec-ops is installed user-globally; workspaces should not add project-local package references or clones."
type: project
scope: workspace
verified_at: 2026-07-21
source: agent:compact-producer
---

## Global openspec-ops installation

`openspec-ops` is installed as the user-level Pi package `git:github.com/a5345534/openspec-ops` under `~/.pi/agent/git/github.com/a5345534/openspec-ops` and recorded in `~/.pi/agent/settings.json`.

Workspace-level `.pi/settings.json` references and `.pi/git/.../openspec-ops` clones were deliberately removed. New and existing workspaces should use the global package rather than adding a local package dependency.

Update the global package with:

```bash
pi update --extension git:github.com/a5345534/openspec-ops
```

For lifecycle actions, honor the exact executable path supplied by the active Pi extension/runtime binding rather than substituting another checkout or PATH binary.

## Evidence

- User requested: "請把所有區域應用openspec-ops的workspace刪除引用，改爲使用全域的".
- The session removed project-local references and clones, then verified: "Remaining local references: (none)", "Remaining project-local clones: (none)", and retained the global package at `/home/shawn/.pi/agent/git/github.com/a5345534/openspec-ops`.
- Subsequent runtime bindings required the exact global executable `/home/shawn/.pi/agent/git/github.com/a5345534/openspec-ops/bin/openspec-ops`.

## Why this is shared

This is an explicit cross-workspace installation convention and prevents duplicate package clones, version drift, and use of the wrong lifecycle executable.
