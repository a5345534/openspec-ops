## ADDED Requirements

### Requirement: Extension command binds change name for slash ops-deliver
The Pi extension SHALL register an `ops-deliver` command that parses a kebab-case change name from slash command arguments (or candidate pick when the name is omitted and candidates exist) and schedules the ops-deliver skill follow-up with that name **explicitly bound** in the follow-up message.

The system MUST NOT require the agent to rediscover the change name solely from an empty args payload when the operator already passed a valid name on the slash line.

#### Scenario: slash with name schedules deliver for that change
- **WHEN** the operator runs `/ops-deliver eve-via-litellm-gateway`
- **AND** the extension is loaded
- **THEN** a follow-up is scheduled that states the change name is `eve-via-litellm-gateway`
- **AND** the agent is instructed not to claim the change name is missing

#### Scenario: slash without name uses candidate pick when available
- **WHEN** the operator runs `/ops-deliver` with no change argument
- **AND** candidate changes exist
- **THEN** the extension prompts to pick a change (or uses the sole candidate)
- **AND** then schedules deliver for the chosen name

#### Scenario: slash without name and no candidates
- **WHEN** the operator runs `/ops-deliver` with no change argument
- **AND** no candidates are discovered
- **THEN** the extension notifies usage / how to start
- **AND** does not schedule a deliver pipeline
