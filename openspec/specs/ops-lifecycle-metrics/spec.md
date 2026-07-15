# ops-lifecycle-metrics Specification

## Purpose

Define local, opt-in, content-free lifecycle metrics for model/cost analysis, review-round yield, and `/ops-deliver` reliability without additional model calls or remote telemetry.
## Requirements
### Requirement: Metrics are local, opt-in, and content-free
The system SHALL keep lifecycle metrics disabled by default and SHALL append the authoritative JSONL records only under a user-local Pi agent directory after explicit enablement. It MAY persist a derived SQLite projection at an operator-selected absolute local path only after explicit database initialization or attachment. It MUST NOT make a network request for metrics and MUST NOT persist prompt text, assistant prose, source content, tool arguments/results, stderr text, or secrets in either representation.

#### Scenario: disabled by default
- **WHEN** the operator has not enabled lifecycle metrics
- **THEN** lifecycle actions run normally
- **AND** no metrics records are appended
- **AND** no SQLite database is created

#### Scenario: enabled records metadata locally
- **WHEN** the operator enables metrics and runs a lifecycle action
- **THEN** metadata records are appended under the local Pi agent directory
- **AND** no conversation/tool content is stored
- **AND** enablement alone does not create or synchronize SQLite

#### Scenario: explicitly selected local projection
- **WHEN** the operator explicitly initializes a SQLite projection at an absolute local path
- **THEN** only metadata records from the retained JSONL source may be ingested there
- **AND** no network request is made

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
The extension SHALL provide `/ops-metrics status|on|off|report|export|reset` and operator-only `/ops-metrics db status|init|sync|rebuild|detach|destroy` controls. JSON reset, database rebuild, and database destroy MUST each require their documented explicit confirmation where destructive, and export SHALL emit metadata records only.

#### Scenario: reset without confirmation
- **WHEN** the operator runs JSON reset without the required confirmation token
- **THEN** no metrics file is deleted
- **AND** usage guidance is shown

#### Scenario: JSON reset leaves SQLite intact
- **WHEN** the operator confirms JSON reset while a SQLite projection is configured
- **THEN** retained JSONL files are deleted
- **AND** the SQLite database is not modified or deleted

#### Scenario: detach leaves database intact
- **WHEN** the operator detaches a configured SQLite database
- **THEN** the local configuration no longer selects it
- **AND** the database file remains intact

#### Scenario: destroy requires confirmation
- **WHEN** the operator invokes database destroy without the exact confirmation token
- **THEN** no database file is deleted
- **AND** usage guidance is shown

### Requirement: Metrics records have stable record and workspace identity
Newly appended metrics records SHALL carry a unique `recordId` and a nullable privacy-preserving `workspaceId`. The workspace identifier SHALL be derived mechanically from the resolved primary Git repository identity so linked worktrees of one repository share an identifier, and it MUST NOT persist an absolute repository path. Unresolvable or legacy workspace identity SHALL remain unknown.

#### Scenario: linked worktrees share workspace identity
- **WHEN** enabled metrics are collected from two linked worktrees of one primary Git repository
- **THEN** their new records contain the same workspace identifier
- **AND** no absolute repository path is stored

#### Scenario: different repositories remain distinguishable
- **WHEN** records are collected from two different primary repositories on one machine
- **THEN** their workspace identifiers differ

#### Scenario: repository identity cannot be resolved
- **WHEN** a record is collected outside a resolvable Git repository
- **THEN** its workspace identifier is unknown
- **AND** the system does not infer one from conversation content

### Requirement: SQLite is an explicitly created derived projection
The system SHALL retain JSONL as the authoritative append-only metrics source and SHALL NOT create or write a SQLite database on collection, enablement, package update, or ordinary JSON reporting. `/ops-metrics db init` SHALL explicitly create the default local database or attach/create an operator-selected absolute local path, and SHALL refuse relative, unrecognized, or incompatible database targets without altering them.

#### Scenario: normal collection does not create SQLite
- **WHEN** metrics are enabled and lifecycle turns complete without database initialization
- **THEN** JSONL records are appended normally
- **AND** no SQLite file is created

#### Scenario: initialize default database
- **WHEN** the operator runs `/ops-metrics db init` on a runtime with SQLite support
- **THEN** a compatible empty projection is created under the openspec-ops agent directory
- **AND** its absolute path is retained in local metrics configuration
- **AND** existing JSONL is not implicitly synchronized

#### Scenario: initialize selected absolute path
- **WHEN** the operator runs database init with an absolute local path
- **THEN** a compatible database is created or attached at that path
- **AND** a pre-existing unrecognized or incompatible database is not overwritten

#### Scenario: relative path is refused
- **WHEN** the operator supplies a relative database path
- **THEN** initialization is refused without creating or changing a database

### Requirement: JSONL ingestion into SQLite is idempotent and backward compatible
`/ops-metrics db sync` SHALL validate retained JSONL records and ingest normalized metadata into the configured compatible database in a bounded transaction. Repeated synchronization MUST NOT duplicate records. Schema-v1 JSONL SHALL remain readable and ingestible with a deterministic legacy record identity and unknown workspace identity, and malformed records SHALL be counted/skipped without modifying source files.

#### Scenario: repeated synchronization
- **WHEN** the operator synchronizes the same retained JSONL records more than once
- **THEN** each logical record appears once in SQLite
- **AND** the result reports inserted and duplicate counts

#### Scenario: legacy schema-v1 ingestion
- **WHEN** retained JSONL contains a valid schema-v1 metrics record
- **THEN** sync assigns it a deterministic legacy record identifier
- **AND** stores unknown workspace identity
- **AND** a later sync does not duplicate it

#### Scenario: malformed source line
- **WHEN** a JSONL source contains a malformed or unsupported line
- **THEN** sync skips and counts the line
- **AND** valid records in the batch remain ingestible
- **AND** the JSONL source is unchanged

### Requirement: SQLite reporting is explicit and exposes projection state
Existing `/ops-metrics report [change]` SHALL continue to report from retained JSONL. `/ops-metrics report --source sqlite [change]` SHALL read normalized metadata from the configured compatible projection and use the same mechanical aggregation semantics without implicitly synchronizing. Database status and SQLite report output SHALL identify the source and expose available row-count and last-sync state so stale projections are not presented as live JSON data.

#### Scenario: default report remains JSON-backed
- **WHEN** a SQLite projection is configured and the operator runs `/ops-metrics report`
- **THEN** the report reads retained JSONL
- **AND** no SQLite synchronization or write occurs

#### Scenario: explicit SQLite report
- **WHEN** the operator runs `/ops-metrics report --source sqlite` with a compatible configured database
- **THEN** the report is built mechanically from database records
- **AND** identifies SQLite as its source
- **AND** no model turn or implicit synchronization occurs

#### Scenario: no database configured
- **WHEN** the operator requests a SQLite report without a configured compatible database
- **THEN** the command shows a local configuration/availability error
- **AND** lifecycle behavior and JSONL data remain unchanged

### Requirement: SQLite lifecycle is isolated and reversible
Database rebuild SHALL require explicit confirmation, clear only a compatible configured projection, and re-ingest currently retained JSONL. Database detach SHALL preserve the file. Database destroy SHALL require explicit confirmation, validate ownership/compatibility before deletion, remove only the configured database and its SQLite sidecar files, and detach it. None of these operations SHALL change metrics collection enablement or JSONL records.

#### Scenario: rebuild from retained JSONL
- **WHEN** the operator confirms database rebuild
- **THEN** the compatible projection is replaced with records currently readable from retained JSONL
- **AND** JSONL records and collection enablement remain unchanged

#### Scenario: destroy configured projection
- **WHEN** the operator confirms destroy for a compatible configured database
- **THEN** that database and its SQLite WAL/SHM sidecars are removed
- **AND** the database is detached
- **AND** JSONL records and collection enablement remain unchanged

#### Scenario: incompatible database is protected
- **WHEN** rebuild or destroy encounters an unrecognized or incompatible configured file
- **THEN** it refuses to clear or delete that file

### Requirement: SQLite availability is optional and fail-open
SQLite operations SHALL dynamically feature-detect `node:sqlite`. If unavailable or if database configuration, locking, parsing, schema, or storage fails, the system SHALL report the local database operation failure without failing or changing JSONL collection, JSON reporting, or any lifecycle action. The SQLite adapter MUST NOT add a network request or model call.

#### Scenario: runtime lacks node sqlite
- **WHEN** the current runtime does not provide `node:sqlite`
- **THEN** database status reports SQLite unavailable
- **AND** database mutation commands do not create files
- **AND** JSONL metrics continue normally

#### Scenario: database is busy or unwritable
- **WHEN** explicit database synchronization cannot acquire/write the configured local database
- **THEN** the operation reports a retryable local failure
- **AND** retained JSONL and lifecycle behavior remain unchanged

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

