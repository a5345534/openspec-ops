## ADDED Requirements

### Requirement: Metrics are local, opt-in, and content-free
The system SHALL keep lifecycle metrics disabled by default and SHALL persist records only in a user-local Pi agent directory after explicit enablement. It MUST NOT make a network request for metrics and MUST NOT persist prompt text, assistant prose, source content, tool arguments/results, stderr text, or secrets.

#### Scenario: disabled by default
- **WHEN** the operator has not enabled lifecycle metrics
- **THEN** lifecycle actions run normally
- **AND** no metrics records are appended

#### Scenario: enabled records metadata locally
- **WHEN** the operator enables metrics and runs a lifecycle action
- **THEN** metadata records are appended under the local Pi agent directory
- **AND** no conversation/tool content is stored

### Requirement: Collection and reporting do not invoke a model
Collection, attribution, aggregation, and report rendering SHALL be mechanical and MUST NOT invoke an LLM, schedule a follow-up message, or expose a telemetry tool to the agent.

#### Scenario: report renders without an agent turn
- **WHEN** the operator runs `/ops-metrics report`
- **THEN** the extension renders a report directly from local records
- **AND** no user/follow-up message is sent to a model

### Requirement: Per-turn raw model usage is attributed with provenance
For enabled metrics, the system SHALL record assistant turn usage fields as reported by Pi, including input, output, cache read/write, optional reasoning, cost, model, and available context usage. Each turn SHALL include an action bucket and attribution source `observed`, `declared`, or `unknown`.

#### Scenario: explicit lifecycle command is observed
- **WHEN** an enabled session invokes an explicit lifecycle command for a change
- **AND** an assistant turn completes
- **THEN** that turn usage is recorded against the command action with `observed` attribution

#### Scenario: missing action remains unknown
- **WHEN** a turn completes without a reliable action context or valid marker
- **THEN** it is recorded in the `unknown` bucket
- **AND** no model is asked to infer its stage

### Requirement: Reports expose attribution coverage
Usage reports SHALL show attributed usage as a share of all recorded usage and SHALL display unknown/unclassified usage separately.

#### Scenario: partially attributed delivery
- **WHEN** some delivery turns lack a reliable action
- **THEN** the report shows coverage below 100 percent
- **AND** includes an unknown/overhead row rather than redistributing those tokens

### Requirement: Review rounds emit and record structured outcomes
The spec-review and impl-review workflows SHALL support a validated structured round summary containing review type, round number, new major/minor counts, major fixes, in-round verification result, and verdict `continue`, `ready`, or `needs_human`. The collector SHALL store counts/verdict only and SHALL record missing or invalid summaries without semantic inference.

#### Scenario: successful full review round
- **WHEN** a full review round completes with a valid metrics summary
- **THEN** its usage and count/verdict fields are available to round reports
- **AND** finding prose is not persisted

#### Scenario: review summary omitted
- **WHEN** a review round ends without a valid structured summary
- **THEN** the report increments missing-summary coverage
- **AND** does not reconstruct a result from natural language

### Requirement: Review reports quantify marginal round yield
The report SHALL aggregate each review type/round by entry count, usage/cost, new-major rate, ready rate, and missing summaries. It MUST NOT automatically modify review max-round settings.

#### Scenario: later-round analysis
- **WHEN** multiple recorded reviews reach rounds two or three
- **THEN** `/ops-metrics report` shows their separate costs and result rates
- **AND** leaves max-round decisions to the operator

### Requirement: Deliver attempts record reliability outcomes
Each enabled `/ops-deliver` invocation SHALL create an attempt associated with its change and start station. Settled attempts SHALL record completion, hard-stop, needs-human, or incomplete outcome, available end station, hard-stop action, stable error code, and whether the attempt resumes an earlier unsuccessful attempt.

#### Scenario: delivery completes through finish
- **WHEN** an enabled deliver attempt successfully reaches finish/done
- **THEN** the attempt is recorded as completed

#### Scenario: delivery hard-stops
- **WHEN** a deliver attempt settles after a stable lifecycle error
- **THEN** it is recorded as hard-stop with action and error code

#### Scenario: later invocation resumes
- **WHEN** the same change is delivered again after an incomplete, hard-stop, or needs-human attempt
- **THEN** the new attempt is marked as a resume

### Requirement: Deliver reports quantify reliability
The report SHALL include attempt count, completed changes, first-invocation completion rate, resume count, needs-human/incomplete counts, and hard-stop distribution by action/error code.

#### Scenario: reliability report across attempts
- **WHEN** metrics contain multiple deliver attempts
- **THEN** the report mechanically summarizes completion and failure distributions

### Requirement: Metrics failures never block lifecycle
Any configuration, parsing, storage, or report failure in metrics MUST NOT fail, alter, merge, skip, or force a lifecycle action.

#### Scenario: metrics storage is unwritable
- **WHEN** collection cannot append a record
- **THEN** the lifecycle action continues unchanged
- **AND** the collector may show a non-blocking warning

### Requirement: Local operator controls
The extension SHALL provide `/ops-metrics status|on|off|report|export|reset`. Reset MUST require explicit confirmation, and export SHALL emit metadata records only.

#### Scenario: reset without confirmation
- **WHEN** the operator runs reset without the required confirmation token
- **THEN** no metrics file is deleted
- **AND** usage guidance is shown
