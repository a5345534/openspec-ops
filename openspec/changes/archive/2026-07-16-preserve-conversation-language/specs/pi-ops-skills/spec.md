## ADDED Requirements

### Requirement: Ops skill output examples do not override conversation language
Packaged ops skill instructions SHALL require agent-generated lifecycle progress, findings, verdicts, hard-stop guidance, and final summaries to use the active conversation language. English fixed phrases and output examples SHALL be treated as semantic/structural templates that are translated when the active language is not English.

#### Scenario: review skill in Chinese session
- **WHEN** an ops review skill runs with active language `zh-Hant`
- **THEN** round reports and verdict explanations are written in Traditional Chinese
- **AND** metrics markers and technical identifiers remain exact

#### Scenario: long deliver loads multiple English skills
- **WHEN** a non-English deliver run loads multiple packaged skills containing English examples
- **THEN** those examples do not supersede the active response-language contract
