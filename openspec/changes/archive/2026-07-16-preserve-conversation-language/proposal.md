## Why

Long-running openspec-ops workflows can drift to English after compaction or English extension/skill handoffs outweigh the operator's original language. Lifecycle progress, review findings, hard stops, and final summaries should remain in the operator's established conversation language throughout the session.

## What Changes

- Maintain a session-scoped, content-free response-language hint derived mechanically from genuine operator input, using script-aware Chinese handling plus broad ISO 639-3 language identification.
- Reinject a mandatory response-language contract before every agent turn so compaction and multi-round workflows do not erase it.
- Ignore extension-generated English follow-ups as language-selection input and bind the current language into `/ops-deliver` handoffs.
- Restore the language hint after reload/resume from session metadata without storing operator prose.
- Define sticky handling for short/ambiguous input and explicit language switching.
- Keep commands, paths, identifiers, error codes, JSON keys, URLs, and metrics markers unchanged.
- Clarify that direct CLI output and fixed administrative UI/report tables are outside the conversational-response guarantee.

## Capabilities

### New Capabilities

- `conversation-language`: Session-scoped operator-language detection, persistence, and per-turn response contract.

### Modified Capabilities

- `ops-deliver`: Bind the active conversation language into extension-generated pipeline handoffs.
- `pi-ops-skills`: Require agent-generated progress and summaries to follow the active conversation language rather than English examples.

## Impact

Affected areas include the guided extension, deliver handoff builder, ops skill instructions, session metadata handling, one production language-identification dependency, and tests. No model call, prompt/prose persistence, project configuration, CLI localization, or lifecycle semantics are added.
