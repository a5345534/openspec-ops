## MODIFIED Requirements

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

## ADDED Requirements

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
