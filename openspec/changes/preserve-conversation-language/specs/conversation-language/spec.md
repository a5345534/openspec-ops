## ADDED Requirements

### Requirement: Conversation response language is session-scoped and sticky
The system SHALL maintain a session-scoped response-language hint from genuine operator input without invoking a model. It SHALL support script-aware Chinese variants and broad mechanically detectable languages represented by ISO 639-3 codes. High-confidence input or an explicit language request SHALL update the hint; short, technical, or ambiguous input SHALL retain the established hint.

#### Scenario: Traditional Chinese operator input
- **WHEN** the operator converses in Traditional Chinese
- **THEN** the active response language becomes `zh-Hant`

#### Scenario: non-CJK language is identified
- **WHEN** the operator provides sufficient natural-language Spanish input
- **THEN** the active response language is recorded as ISO 639-3 `spa`
- **AND** subsequent lifecycle reporting uses Spanish

#### Scenario: short acknowledgement after established language
- **WHEN** the active language is `zh-Hant`
- **AND** the operator replies with a short ambiguous Latin acknowledgement such as `ok`
- **THEN** the active language remains `zh-Hant`

#### Scenario: explicit language switch
- **WHEN** the operator explicitly requests English
- **THEN** subsequent conversational reporting uses English

#### Scenario: extension-generated follow-up
- **WHEN** openspec-ops injects an English follow-up message
- **THEN** that extension-origin message does not change the operator language hint

### Requirement: Response language survives compaction and session runtime replacement
Before every agent turn, the extension SHALL inject a hidden mandatory language contract derived from the active hint. It SHALL persist only the language code as session metadata and restore the latest valid hint after reload or resume. It MUST NOT persist operator prompt text or prose for language handling.

#### Scenario: long workflow after compaction
- **WHEN** a workflow started in Traditional Chinese continues after compaction
- **THEN** lifecycle progress, review findings, hard stops, and final summaries remain in Traditional Chinese

#### Scenario: reload restores language
- **WHEN** an extension reload occurs after a language hint was stored
- **THEN** the new extension runtime restores that hint from session metadata

#### Scenario: metadata privacy
- **WHEN** language state is persisted
- **THEN** the custom entry contains a supported language code only
- **AND** contains no operator message text

### Requirement: Technical literals remain exact
The response-language contract SHALL require natural-language reporting in the active language while preserving commands, paths, change/branch names, identifiers, error codes, JSON keys, URLs, raw tool output, and metrics markers exactly.

#### Scenario: localized error explanation
- **WHEN** a Chinese lifecycle report explains `remote_not_configured`
- **THEN** the explanation is Chinese
- **AND** `remote_not_configured` and any remediation command remain unchanged
