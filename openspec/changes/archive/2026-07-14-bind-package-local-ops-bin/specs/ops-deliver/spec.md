## MODIFIED Requirements

### Requirement: Extension command binds change name for slash ops-deliver
The Pi extension SHALL register an `ops-deliver` command that parses a kebab-case change name from slash command arguments (or candidate pick when the name is omitted and candidates exist), resolves a validated openspec-ops executable for the loaded package session, and schedules the ops-deliver skill follow-up with both the change name and exact executable path explicitly bound in the follow-up message.

The system MUST NOT require the agent to rediscover the change name or package-local executable solely from an empty args payload/PATH when the extension already received the name and resolved its runtime. If no executable can be validated, the extension SHALL report a clear hard stop and SHALL NOT schedule the deliver follow-up.

#### Scenario: slash with name schedules deliver for that change
- **WHEN** the operator runs `/ops-deliver eve-via-litellm-gateway`
- **AND** the extension is loaded from a project-local package with a usable bundled CLI
- **THEN** a follow-up is scheduled that states the change name is `eve-via-litellm-gateway`
- **AND** binds the validated absolute openspec-ops executable path
- **AND** the agent is instructed not to claim the change name or binary is missing

#### Scenario: slash without name uses candidate pick when available
- **WHEN** the operator runs `/ops-deliver` with no change argument
- **AND** candidate changes exist
- **THEN** the extension prompts to pick a change (or uses the sole candidate)
- **AND** then schedules deliver for the chosen name with the resolved runtime binding

#### Scenario: slash without name and no candidates
- **WHEN** the operator runs `/ops-deliver` with no change argument
- **AND** no candidates are discovered
- **THEN** the extension notifies usage / how to start
- **AND** does not schedule a deliver pipeline

#### Scenario: runtime unavailable before scheduling
- **WHEN** the loaded package CLI, explicit override, and PATH do not yield a validated executable
- **THEN** the extension reports the binary resolution hard stop
- **AND** does not schedule the deliver follow-up

## ADDED Requirements

### Requirement: Deliver preserves one resolved CLI runtime throughout the pipeline
A deliver invocation originating from the guided extension SHALL use the extension-resolved openspec-ops executable for every CLI-backed lifecycle action in that pipeline, including start, where/station preflight, ship, merge, and finish. The agent MUST quote the bound path or inherited `OPENSPEC_OPS_BIN` safely and MUST NOT substitute raw Git, `npx`, or an unrelated PATH binary.

#### Scenario: project-local package completes start without global link
- **WHEN** openspec-ops is installed as a project-local Pi git package
- **AND** `OPENSPEC_OPS_BIN` is unset
- **AND** no `openspec-ops` command exists on PATH
- **AND** the package-local bin is executable
- **THEN** `/ops-deliver <change>` reaches and executes start with that package-local bin
- **AND** no `npm link` step is required

#### Scenario: later deliver stages retain the same runtime
- **WHEN** a package-originated deliver advances from start to later CLI-backed stations
- **THEN** ship, merge, and finish use the same bound executable identity unless the invocation hard-stops

#### Scenario: explicit operator override remains authoritative
- **WHEN** the Pi process starts with a valid explicit `OPENSPEC_OPS_BIN`
- **THEN** the extension binds that executable rather than replacing it with the package-local or PATH candidate

#### Scenario: bound executable disappears
- **WHEN** a previously bound executable is missing or non-executable before a later action
- **THEN** deliver hard-stops with executable guidance
- **AND** does not fall back to raw lifecycle Git commands
