## Context

The guided extension injects runtime/config context on every `before_agent_start`, but no response-language contract. Most skills, deliver follow-ups, and fixed output examples are English. After compaction or several lifecycle stages, those instructions can dominate the operator's earlier language.

## Goals / Non-Goals

**Goals:** preserve the established operator language across compaction, extension follow-ups, reviews, reload/resume, and long deliver runs without an extra model call or storing prose.

**Non-Goals:** translate direct CLI human output, every extension administration notification, metrics tables, identifiers, raw errors, or guarantee perfect automatic identification of every short multilingual utterance.

## Decisions

### Session language state

A small pure helper classifies high-confidence script/language hints. Chinese is handled first as `zh-Hant`/`zh-Hans`; Japanese and Korean scripts map directly; other sufficiently long natural-language input is identified with the production `franc-min` classifier and retained as an ISO 639-3 code. Han text without distinctive simplified/traditional evidence keeps the prior Chinese variant. Short Latin acknowledgements do not switch an established language. Explicit requests for the supported labels win.

The extension observes only genuine interactive/RPC input; extension-generated input never updates state. Slash handlers may observe a natural-language objective but a bare command/change name does not switch language.

### Content-free persistence

When a high-confidence hint changes, append a custom session entry containing only the locale code. On `session_start`, restore the latest valid entry. No user text, prompt excerpt, project setting, or global preference is stored.

### Per-turn contract

Every `before_agent_start` hidden message includes the current locale and requires lifecycle progress, findings, verdicts, hard stops, and summaries in that language. Technical literals remain exact. For unknown language, the contract tells the model to mirror the latest genuine operator message and ignore English extension handoffs.

### Deliver binding and skill alignment

`buildDeliverFollowup` carries the language contract explicitly. Ops skill instructions state that English output examples are structural rather than mandatory wording. This prevents a later English skill template from conflicting with the injected requirement.

## Risks / Trade-offs

- [Short or mixed text is ambiguous] → Sticky state and explicit language requests take precedence.
- [Statistical language identification can be uncertain on short or mixed text] → Require sufficient natural text, use sticky state for ambiguous input, and allow explicit requests to override; no classifier model call is made.
- [Direct extension notifications remain English] → Scope the guarantee to conversational agent reporting; UI localization can be a separate change.
- [Session metadata adds entries] → Append only when a confident language value changes.
