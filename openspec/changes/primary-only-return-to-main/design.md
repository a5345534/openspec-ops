## Context

Strict `--return-to-main` requires submodules to attach to a default branch whose tip equals the parent gitlink. In monorepos the tip often moves ahead of the gitlink, producing `incompatible_default` hard-stops after lifecycle success. Operators still want automatic primary update after deliver.

Existing finish flags already separate concerns:
- `--sync-primary` — clean primary, checkout base, ff-only pull
- `--sync-submodules` — `submodule update --init --recursive` (detached @ gitlink)
- `--return-to-main` — composite including attach

## Goals / Non-Goals

**Goals:**
- Third policy value `primary-only` for Pi config (session/user/env).
- Deliver maps policy → flags without new CLI composite flag (reuse existing).
- Injection text tells the agent which flags to pass.
- Docs: primary-only vs required vs off; detached@gitlink is correct.

**Non-Goals:**
- Auto-checkout submodule default tip when incompatible.
- Changing built-in default from `off`.
- Teaching bare CLI to read user store.
- Soft-failing `--return-to-main` attach failures inside the same exit (separate #44 UX item).

## Decisions

1. **Values:** `off | primary-only | required` (reject other strings).
2. **Deliver/finish skill mapping:**
   - `off` → no sync flags
   - `primary-only` → `--sync-primary --sync-submodules`
   - `required` → `--return-to-main`
3. **Why include submodule update in primary-only:** after primary ff, gitlinks may change; update pins working trees to SSOT without attach. Does not require tip == gitlink on a branch name.
4. **Injection:** three distinct agent instructions for the three policies.
5. **Menu:** value choices include `primary-only`.

## Risks / Trade-offs

- **[Risk] Dirty primary still fails primary-only** → Expected; operator cleans primary (same as sync-primary today).
- **[Risk] Operators confuse primary-only with full attach** → Docs + injection wording.
- **[Trade-off] primary-only still mutates primary** → Intentional opt-in vs off.

## Migration

- Existing `required`/`off` unchanged.
- Operators on monorepos: `/ops-config set --user finish.return-to-main primary-only`.
