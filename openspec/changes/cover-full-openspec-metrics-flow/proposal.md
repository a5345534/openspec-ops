## Why

Local metrics already capture model usage for every enabled Pi assistant turn, but attribution only covers the delivery-oriented action set. Discovery, spec synchronization, prompt-expanded OpenSpec invocations, autonomous agent work, and ordinary continuation turns frequently collapse into `unknown`, preventing reliable analysis of cost and model behavior across the full OpenSpec workflow.

## What Changes

- Decouple metrics activity taxonomy from `/ops-next` lifecycle navigation so non-delivery activities can be represented without changing the delivery state machine.
- Add first-class attribution for `opsx-explore` and `opsx-sync` alongside the existing propose/apply/archive and ops lifecycle stages.
- Mechanically recognize supported stock OpenSpec prompt/skill signatures after Pi expands slash commands, without storing prompt text or invoking a model.
- Preserve marker and shell-command attribution for autonomous agent execution, with explicit precedence and conservative fallback to `unknown`.
- Define bounded activity-context lifetime rules so continuation turns can be attributed when mechanically justified without allowing stale explore context to contaminate unrelated work.
- Extend JSONL/SQLite validation and reports to accept the expanded activity set while retaining backward compatibility and `unknown` coverage disclosure.
- Document exactly what is and is not covered, including the distinction between per-stage usage attribution and extension-created `/ops-deliver` reliability attempts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ops-lifecycle-metrics`: Expand content-free activity attribution to cover the full supported OpenSpec flow, prompt-expanded invocations, autonomous execution signals, and safe continuation semantics.

## Impact

Affected areas include lifecycle metrics types/runtime/markers/storage/reporting/SQLite compatibility, the guided Pi extension input and turn hooks, tests for stock OpenSpec prompt signatures and autonomous execution, and README metrics documentation. The change does not wrap or replace consumer-owned `openspec-*`/`opsx-*` resources, does not inspect semantics with a model, and does not persist prompt/tool/source content.
