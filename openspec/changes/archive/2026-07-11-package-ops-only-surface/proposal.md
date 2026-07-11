## Why

Installing `openspec-ops` as a Pi package currently loads **all** of `.pi/skills/**` and `.pi/prompts/**`, including vendored **OpenSpec-named** assets (`openspec-propose`, `opsx-propose`, etc.). Consumer projects that already run their own `openspec init` / `openspec update` then have **duplicate skill names**; Pi keeps the first found, so the package can shadow the project’s OpenSpec workflow. Owners correctly report that “the package brings someone else’s OpenSpec.” openspec-ops must be a **pure sidecar**: add worktree/gates/ops-* only, never replace the consumer’s OpenSpec surface.

## What Changes

- **Narrow Pi package surface** so installed resources include only:
  - extensions (`openspec-ops-*.ts`)
  - **ops-*** skills and **ops-*** prompts
  - bins: `openspec-ops`, `openspec-ops-intercept` (**never** `openspec`)
- **Stop exporting** `openspec-*` skills and `opsx-*` prompts via `package.json` `pi.skills` / `pi.prompts`; tighten `files` accordingly
- **Quarantine** vendored upstream Pi assets under **`vendor/openspec-pi-ref/`** (not deleted from git; **not** listed in `pi.*` or package load paths)
- **Worktree alignment without package `openspec-propose`:** extension inject + opt-in intercept + doctor + **`docs/snippets/worktree-alignment-block.md`** for consumers to paste into **their** propose skill
- **v1 does not ship** a thin `ops-propose` orchestrator (optional follow-up)
- **Doctor:** stop requiring alignment markers on a **package-local** `openspec-propose`; optionally check **consumer project** propose skill if present; assert package does not export openspec-*
- **README / migration:** pure sidecar; no second `openspec-propose`; prior consumers of package-shadowed propose → inject/intercept/snippet

## Capabilities

### New Capabilities
- `pi-package-ops-surface`: What the openspec-ops Pi package may export so it cannot shadow consumer OpenSpec skills/prompts

### Modified Capabilities
- `worktree-write-alignment`: Alignment must not require shipping/overriding `openspec-propose` / `opsx-propose`
- `pi-ops-skills`: Package export surface is ops-* only

## Impact

- **Consumers:** After `pi update --extensions`, only ops-* + extension from this package; project OpenSpec skills stay authoritative
- **Repo:** `package.json` pi/files; move openspec/opsx under `vendor/openspec-pi-ref/`; doctor + README + snippet
- **Risk:** Teams that relied on package-shadowed propose lose that path—document migration
