## ADDED Requirements

### Requirement: Empty admin slash opens a guided menu when UI is available
When the operator invokes `/ops-config` or `/ops-metrics` with **no arguments** and the extension context has interactive UI selection available, the system SHALL present a guided menu of high-level actions instead of requiring memorized subcommands. Selecting an action SHALL drive the same underlying operations as the corresponding direct subcommands. Cancel or dismissed selection SHALL stop without mutating config or metrics state.

#### Scenario: bare ops-config with UI
- **WHEN** the operator runs `/ops-config` with no arguments
- **AND** UI selection is available
- **THEN** a config admin menu is shown
- **AND** no session or user preference is changed until the operator completes an edit or clear action

#### Scenario: bare ops-metrics with UI
- **WHEN** the operator runs `/ops-metrics` with no arguments
- **AND** UI selection is available
- **THEN** a metrics admin menu is shown
- **AND** collection enablement and databases are unchanged until the operator chooses an action that mutates them

#### Scenario: cancel leaves state unchanged
- **WHEN** the operator dismisses or cancels an admin menu selection
- **THEN** no config or metrics mutation from that menu invocation occurs

### Requirement: Explicit arguments bypass menus
When `/ops-config` or `/ops-metrics` is invoked with one or more arguments, the system SHALL execute the existing direct subcommand path and MUST NOT open the guided root menu for that invocation.

#### Scenario: direct metrics status
- **WHEN** the operator runs `/ops-metrics status`
- **THEN** status is reported without presenting the root metrics menu

#### Scenario: direct config set
- **WHEN** the operator runs `/ops-config set finish.return-to-main required`
- **THEN** the value is applied through the direct set path
- **AND** the root config menu is not shown

### Requirement: No-UI fallback is non-blocking text
When UI selection is unavailable, bare `/ops-config` or `/ops-metrics` SHALL NOT block on a prompt. The system SHALL show a text catalog of available actions (and for config, effective values or how to show them) and MUST NOT auto-run destructive metrics operations.

#### Scenario: bare metrics without UI
- **WHEN** `/ops-metrics` is run with no arguments and UI selection is unavailable
- **THEN** a text catalog or status-oriented summary is shown
- **AND** JSONL is not reset and no database is destroyed as a side effect of the bare invocation

#### Scenario: bare config without UI
- **WHEN** `/ops-config` is run with no arguments and UI selection is unavailable
- **THEN** a text catalog and/or effective configuration listing is shown
- **AND** session and user stores are not cleared as a side effect of the bare invocation

### Requirement: Destructive menu actions require interactive confirmation
When a guided menu path would reset JSONL metrics records, rebuild or destroy a SQLite projection, or clear user preferences, the system SHALL obtain an interactive confirmation (for example `ui.confirm`) before performing the mutation. Declined confirmation MUST leave data intact. Direct string subcommands that already require a `confirm` token remain valid for no-UI and scripted use.

#### Scenario: menu rebuild declined
- **WHEN** the operator chooses database rebuild from the metrics menu
- **AND** declines confirmation
- **THEN** the SQLite projection is not rebuilt or cleared

#### Scenario: direct confirm token still works
- **WHEN** the operator runs `/ops-metrics db rebuild confirm` with a valid confirmation token path
- **THEN** rebuild proceeds under existing metrics rules without requiring a UI menu
