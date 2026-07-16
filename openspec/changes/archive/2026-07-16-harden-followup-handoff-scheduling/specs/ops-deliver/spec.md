## ADDED Requirements

### Requirement: Deliver slash handoff avoids the compaction flush call stack
After `/ops-deliver` has validated its change and runtime binding, the extension SHALL defer its `sendUserMessage` call to a later host task and SHALL deliver the pipeline handoff as `followUp`. The handoff MUST be sent at most once and MUST never use `steer`.

#### Scenario: deliver invoked during busy or compaction-adjacent handling
- **WHEN** Pi dispatches `/ops-deliver` while busy or while flushing compaction-queued input
- **THEN** the slash handler does not synchronously start the deliver turn inside that dispatch stack
- **AND** a later host task sends exactly one bound deliver follow-up
- **AND** the delivery mode is `followUp`

#### Scenario: idle deliver invocation remains non-interrupting
- **WHEN** `/ops-deliver` is invoked while the host is idle
- **THEN** it still sends exactly one deferred `followUp` handoff with the validated change and runtime binding

### Requirement: Deliver scheduling notification follows API acceptance
The extension SHALL notify that ops-deliver was queued only after the deferred send API returns without throwing. If the API throws synchronously, the extension SHALL report that deliver was not queued, MUST NOT emit successful scheduling wording, and MUST NOT automatically retry the handoff.

#### Scenario: deliver sender accepts
- **WHEN** the deferred deliver sender returns without throwing
- **THEN** the extension reports that ops-deliver was queued for the selected change

#### Scenario: deliver sender rejects
- **WHEN** the deferred deliver sender throws
- **THEN** the extension reports that ops-deliver was not queued
- **AND** does not report successful scheduling
- **AND** invokes the sender only once

### Requirement: Deliver compatibility workaround is traceable
Documentation for the deferred handoff SHALL identify Pi 0.80.7 as an affected version and reference upstream issue `earendil-works/pi#6728`. Removal of the workaround SHALL require a supported Pi version with a verified queue-flush fix while retaining regression coverage for exactly-once follow-up delivery.

#### Scenario: maintainer evaluates workaround removal
- **WHEN** a maintainer inspects the handoff implementation or compatibility documentation
- **THEN** the affected Pi version and upstream issue are discoverable
- **AND** the retained regression expectation is explicit
