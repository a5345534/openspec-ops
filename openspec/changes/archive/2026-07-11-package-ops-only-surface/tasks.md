## 1. Package manifest and tree

- [x] 1.1 Narrow `package.json` `pi.skills` / `pi.prompts` to **ops-*** only (no openspec-*/opsx-*)
- [x] 1.2 Tighten `files` so published layout does not present vendored OpenSpec Pi assets as package resources
- [x] 1.3 Confirm `bin` has no `openspec` key
- [x] 1.4 **Move** `.pi/skills/openspec-*` and `.pi/prompts/opsx-*` to `vendor/openspec-pi-ref/` (quarantine; do not delete from git; not in `pi.*`)

## 2. Alignment without shadow skills

- [x] 2.1 README: pure sidecar; alignment via extension + intercept + snippet; **not** package `openspec-propose`
- [x] 2.2 Add `docs/snippets/worktree-alignment-block.md` for consumers to paste into **their** propose skill
- [x] 2.3 **Do not** add thin `ops-propose` in this change (follow-up only if needed)
- [x] 2.4 Doctor: remove/gate package-local `openspec-propose` marker requirement; optional consumer-cwd check only if that file exists

## 3. Specs and verification

- [x] 3.1 Keep change specs consistent; sync to main on archive
- [x] 3.2 Automated test: package.json `pi.skills`/`pi.prompts` ops-allowlist only
- [x] 3.3 Full suite green; migration note for prior package-shadowed propose users
