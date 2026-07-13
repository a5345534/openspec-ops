# Change: ops-deliver-dedupe-slash

## Why

After `ops-deliver-register-command`, `/ops-deliver` appears **twice** in Pi autocomplete:

1. Extension `registerCommand("ops-deliver")` — correct entry (binds slash args)
2. Prompt template `.pi/prompts/ops-deliver.md` — same slash name, expands markdown only

Pi registers prompt templates as `/<filename>` and extension commands as `/<name>`. Duplicate names confuse operators (and may surface as `ops-deliver` + `ops-deliver:1`).

`ops-next` already avoids this: **extension + skill only**, no prompt file.

## What Changes

- **Remove** `.pi/prompts/ops-deliver.md`
- Drop it from `package.json` `files`
- Keep skill + extension command as the single slash surface
- Docs: slash `/ops-deliver` is extension-owned; skill is `/skill:ops-deliver` / agent-loaded

## Capabilities

### Modified Capabilities

- `ops-deliver`: single slash command via extension; no prompt template
- `pi-package-ops-surface`: ops-deliver prompt no longer on package `files` allowlist

## Impact

- Consumers on `pi update --extensions` (git/npm to a ref that includes this delete) lose the prompt file from the package clone → one `/ops-deliver`
- Does not delete manually copied project-local prompts outside the package

## Non-goals

- Deduping all other ops-* that still ship prompt+skill without registerCommand (optional follow-up)
- Changing deliver pipeline / merge consent / reviews
