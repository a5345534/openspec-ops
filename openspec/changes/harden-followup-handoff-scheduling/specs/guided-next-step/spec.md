## ADDED Requirements

### Requirement: Guided next handoff avoids the compaction flush call stack
When `/ops-next` schedules the operator-selected lifecycle command, the extension SHALL defer its `sendUserMessage` call to a later host task and SHALL deliver it as `followUp`. It MUST invoke the sender at most once and MUST NOT use `steer` for this handoff.

#### Scenario: selected action during busy or compaction-adjacent handling
- **WHEN** the operator selects a next lifecycle action while the host is busy or dispatching a compaction-queued slash command
- **THEN** the slash handler returns without immediately starting the lifecycle turn
- **AND** a later host task sends exactly one follow-up lifecycle message
- **AND** no steering message is sent

#### Scenario: normal idle next invocation
- **WHEN** the operator selects a next action while the host is otherwise idle
- **THEN** the same deferred follow-up path sends exactly one selected command

### Requirement: Guided next notification reflects handoff acceptance
The extension SHALL display successful queued/scheduled wording only after `sendUserMessage` returns without throwing. If the handoff API rejects synchronously, the extension SHALL report that the follow-up was not queued and MUST NOT emit a success notification for that attempt.

#### Scenario: follow-up sender accepts
- **WHEN** the deferred sender returns without throwing
- **THEN** the extension notifies that the selected action was queued

#### Scenario: follow-up sender rejects
- **WHEN** the deferred sender throws
- **THEN** the extension reports a failed handoff
- **AND** does not claim the action was scheduled
- **AND** does not retry automatically
