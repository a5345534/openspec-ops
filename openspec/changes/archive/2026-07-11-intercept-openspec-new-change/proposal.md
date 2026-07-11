## Why

Users (and agents) typically run `/opsx-propose` **without** a kebab change name; the agent later runs `openspec new change <name>`. Existing Pi gates arm only on slash input with a parseable name, so ensure/review automation almost never fires for real usage. OpenSpec has no lifecycle event bus; the stable machine surface is the CLI agent contract. The identity moment is **`openspec new change <name>`**, which can be intercepted **before** the change directory exists—enabling worktree ensure prior to artifacts, without forking OpenSpec.

## What Changes

- Add an **openspec CLI intercept wrapper** (opt-in PATH entry, e.g. `openspec-ops-intercept`) that detects `openspec new change <kebab-name>` **pre-exec**
- On intercept with policy **`on`**: run `openspec-ops start <name>`, then **forward** to the real upstream `openspec` (cwd = worktree when known). Policy **`off`**: pure forward. **v1 does not implement `ask`**
- On start hard failure under `on`: **do not** run upstream `new change` (fail-closed)
- Prefer scaffold in the change worktree via child cwd after successful start; document that later agent commands may still use another cwd (limitation + optional stderr hint)
- **Review** is **not** armed inside the shim process; the Pi extension uses **settle-time discovery** of `proposal.md` (extend `pi-auto-review-follow-up`) so agent-named changes still get follow-up `/ops-review` without slash names
- Keep slash-based ensure as optional accelerator when a name is present on the slash line—not the sole path
- Document install (alias/PATH), `OPENSPEC_REAL_BIN`, `OPENSPEC_OPS_INTERCEPT_NEW_CHANGE=on|off`; no OpenSpec source modifications
- **Does not** reimplement propose/apply/archive; **does not** require users to name changes on the slash line

## Capabilities

### New Capabilities
- `openspec-cli-intercept`: Pre-exec intercept of `openspec new change` to ensure worktree then forward to real OpenSpec, without modifying OpenSpec

### Modified Capabilities
- `pi-auto-ensure-on-propose`: Slash ensure remains optional; slash without name does not ensure at input; primary ensure-before-scaffold is CLI intercept
- `pi-auto-review-follow-up`: Settle-time discovery of ready proposals without requiring prior slash arm

## Impact

- **New code**: intercept bin, real-bin resolve, argv parse, start-then-spawn; extension discovery for review
- **Integrates with**: `openspec-ops start`/`where`, existing auto-review follow-up
- **Does not change**: `@fission-ai/openspec` source, opsx skill bodies
- **UX**: agent-named changes get worktrees before scaffold when intercept is on PATH; `/opsx-propose` without args works with automation
- **Risk**: PATH mis-resolve (mitigate REAL_BIN); start fail blocks create under `on`; mkdir-without-CLI bypass; agent may write later artifacts outside worktree cwd
