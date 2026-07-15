## ADDED Requirements

### Requirement: Human-readable metrics reports are compact and aligned
The system SHALL render `/ops-metrics report` as deterministic fixed-width plain text with aligned textual and numeric columns, stable units, and explicit totals. It MUST bound unexpectedly long action, model, or distribution labels so one value cannot make the report unbounded in the Pi TUI. JSONL and SQLite reports SHALL use the same table layout and aggregation semantics, apart from source/projection metadata.

#### Scenario: report contains usage records
- **WHEN** a human-readable report contains usage in multiple action or model buckets
- **THEN** numeric columns are right-aligned under stable headings
- **AND** action and model sections display totals derived from all included turns
- **AND** token, percentage, context, and monetary values use consistent units

#### Scenario: report contains a long identifier
- **WHEN** an action, model, or hard-stop identifier exceeds its declared display width
- **THEN** the renderer deterministically truncates the identifier
- **AND** the table remains within its bounded layout

#### Scenario: SQLite report is requested
- **WHEN** the operator renders an explicit SQLite-backed report
- **THEN** the report identifies the projection and synchronization state
- **AND** uses the same aligned sections and totals as a JSONL-backed report

#### Scenario: report section has no records
- **WHEN** a report section has no applicable records
- **THEN** it emits a compact explicit empty-state line
- **AND** does not produce malformed table rows

### Requirement: Human-readable reports disclose cost provenance
The system SHALL label report monetary values as USD estimates derived from Pi model-registry rates and provider-reported token usage. It MUST NOT describe those values as provider-reported charges, invoices, subscription charges, or openspec-ops pricing calculations. Because existing usage records do not distinguish unavailable pricing from configured zero rates, the report SHALL disclose that zero-valued estimates are ambiguous and MUST NOT fabricate missing-price coverage.

#### Scenario: report displays monetary values
- **WHEN** a human-readable report includes cost columns
- **THEN** the report states that cost is a USD estimate based on Pi model-registry rates and provider token usage
- **AND** openspec-ops only aggregates the captured values

#### Scenario: report displays zero cost
- **WHEN** one or more included usage aggregates have zero cost
- **THEN** the report does not claim that the model was free
- **AND** explains that zero may mean unavailable or zero configured rates

#### Scenario: provider uses subscription authentication
- **WHEN** usage was produced through provider subscription or OAuth authentication
- **THEN** the report does not characterize the estimate as an incremental billed charge
