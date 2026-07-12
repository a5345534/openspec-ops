## 1. Specs (L1 + L3)

- [x] 1.1 MODIFIED main `worktree-write-alignment` — drop AUTO_START gate; rewrite ensure-handoff + doctor/README scenarios off auto-ensure language
- [x] 1.2 MODIFIED `worktree-loop-closure` — no AUTO_START condition; no live AUTO_* in loop docs reqs
- [x] 1.3 Tighten `pi-auto-*` retired stubs (no live env switches)
- [x] 1.4 Grep non-archive tree for `OPENSPEC_OPS_AUTO_`; only retired/explicit-removed prose allowed

## 2. Naming and package (L2)

- [x] 2.1 Rename `.pi/extensions/openspec-ops-auto-ensure.ts` → `openspec-ops-guided.ts`; update references
- [x] 2.2 Update `package.json` description
- [x] 2.3 Clean stale auto-ensure path comments in `src/ops-runtime`

## 3. Docs and vendor

- [x] 3.1 `docs/snippets/worktree-alignment-block.md` match L1
- [x] 3.2 `vendor/openspec-pi-ref` propose/apply skills/prompts: remove AUTO_START as live gate
- [x] 3.3 README: extension name + retired auto capability map

## 4. Verify

- [x] 4.1 Tests still green; no new runtime auto behavior
