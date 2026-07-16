## ADDED Requirements

### Requirement: Deliver handoff preserves the operator conversation language
The guided extension SHALL bind the active session response-language contract into the extension-generated `/ops-deliver` follow-up. The English control text in that follow-up MUST NOT cause the pipeline to switch away from the operator language.

#### Scenario: Chinese deliver invocation
- **WHEN** the active response language is `zh-Hant`
- **AND** `/ops-deliver` generates its bound follow-up
- **THEN** the follow-up requires conversational lifecycle reporting in Traditional Chinese
- **AND** retains technical commands and identifiers unchanged

#### Scenario: unknown language hint
- **WHEN** no high-confidence locale is stored
- **THEN** deliver instructs the agent to mirror the latest genuine operator-authored language
- **AND** not to infer language from extension-generated English control text
