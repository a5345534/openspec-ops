# Design: ops-deliver-dedupe-slash

## Root cause

| Source | Name | Role |
|---|---|---|
| extension | `/ops-deliver` | parse args, followUp skill |
| prompt file | `/ops-deliver` | expand markdown |
| skill | `/skill:ops-deliver` | full instructions (OK, different path) |

## Fix (mirror ops-next)

1. Delete `.pi/prompts/ops-deliver.md`
2. Remove from `package.json` `files` array
3. Skill + README: document that slash is extension-only
4. `pi.prompts` glob `.pi/prompts/ops-*.md` stays; missing file simply not discovered

## Consumer update

- git package: `pi update --extensions` reset/clean → file gone
- pinned old ref: still has prompt until retarget
- manual project copies: not auto-removed

## Tests

- package-export-surface: expect ops-deliver **skill** present; **must not** require prompt path
- optional: assert `files` does not include `.pi/prompts/ops-deliver.md`
