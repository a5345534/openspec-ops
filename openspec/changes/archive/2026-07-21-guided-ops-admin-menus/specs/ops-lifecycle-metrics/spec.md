## ADDED Requirements

### Requirement: Bare metrics command offers guided navigation
When `/ops-metrics` is invoked with no arguments and interactive UI is available, the system SHALL present a guided metrics admin menu covering at least status, enable/disable collection, report, export, database operations, and JSONL reset entry points, per the shared admin-menu contract. Menu actions MUST call the same mechanical operations as the corresponding direct subcommands and MUST NOT invoke a model.

#### Scenario: menu enable collection
- **WHEN** the operator chooses enable from the metrics menu
- **THEN** lifecycle metrics collection becomes enabled under the local agent directory
- **AND** no model turn is started for that action

#### Scenario: menu report uses existing aggregation
- **WHEN** the operator completes a report action from the metrics menu with JSONL source
- **THEN** a mechanical report is rendered from retained records
- **AND** no follow-up message is sent to a model

## MODIFIED Requirements

### Requirement: Local operator controls
The extension SHALL provide `/ops-metrics status|on|off|report|export|reset` and operator-only `/ops-metrics db status|init|sync|rebuild|detach|destroy` controls. JSON reset, database rebuild, and database destroy MUST each require their documented explicit confirmation where destructive, and export SHALL emit metadata records only.

Bare `/ops-metrics` with no arguments SHALL follow the admin menu contract (guided menu when UI is available; non-blocking text fallback otherwise). Destructive actions chosen from the guided menu MUST use interactive confirmation instead of requiring the operator to type a confirmation token; direct subcommands that use a `confirm` token remain required for those string forms.

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

#### Scenario: menu destroy requires interactive confirmation
- **WHEN** the operator chooses database destroy from the metrics menu
- **AND** does not accept interactive confirmation
- **THEN** no database file is deleted

#### Scenario: direct subcommands remain available
- **WHEN** the operator runs `/ops-metrics db sync`
- **THEN** synchronization runs under existing SQLite rules without opening the root metrics menu
