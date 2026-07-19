## ADDED Requirements

### Requirement: Metrics activity taxonomy covers the supported OpenSpec flow
The metrics system SHALL represent `opsx-explore` and `opsx-sync` in addition to the existing propose, review, apply, ship, merge, archive, finish, deliver-overhead, and unknown activities. Metrics activity identifiers MUST remain independent from `/ops-next` lifecycle navigation actions so reporting coverage does not alter station transitions or menus.

#### Scenario: discovery turn is represented
- **WHEN** an enabled turn is mechanically attributed to stock OpenSpec explore
- **THEN** its action is `opsx-explore`
- **AND** its change may be `null` when exploration precedes change creation

#### Scenario: spec synchronization is represented
- **WHEN** an enabled turn is mechanically attributed to stock OpenSpec spec synchronization
- **THEN** its action is `opsx-sync`
- **AND** `/ops-next` legal edges remain unchanged

### Requirement: Stock OpenSpec expanded invocations are recognized mechanically
The collector SHALL mechanically recognize supported raw slash forms and high-confidence expanded prompt/skill signatures for explore, propose, apply, sync, and archive. Recognition MUST NOT invoke a model, persist inspected input text or arguments, or register/wrap/replace consumer-owned OpenSpec commands. Unsupported or ambiguous signatures SHALL remain `unknown`.

#### Scenario: expanded explore prompt
- **WHEN** Pi expands a supported stock `/opsx-explore` prompt before the input hook observes it
- **AND** metrics are enabled
- **THEN** the resulting invocation context is attributed to `opsx-explore` with source `observed`
- **AND** no prompt text or provided argument is persisted

#### Scenario: expanded sync skill
- **WHEN** the observed operator input matches the supported stock OpenSpec sync signature
- **THEN** the invocation context is attributed to `opsx-sync`

#### Scenario: ordinary prose is not classified
- **WHEN** an operator message discusses exploration or synchronization but does not match a supported command or structural signature
- **THEN** the collector leaves the activity `unknown`
- **AND** does not ask a model to infer it

#### Scenario: stock reference signature drifts
- **WHEN** an updated OpenSpec prompt no longer satisfies the supported signature contract
- **THEN** collection continues fail-open in `unknown`
- **AND** lifecycle execution is unaffected

### Requirement: Autonomous execution uses explicit mechanical signals
When an agent autonomously executes workflow work without a slash invocation, a valid structured stage marker or recognized workflow-boundary shell command SHALL establish the activity context. File edits, arbitrary prose, and helper commands such as `openspec status`, `instructions`, or `validate` MUST NOT independently establish or replace an activity.

#### Scenario: autonomous apply declares marker
- **WHEN** an assistant emits a valid `opsx-apply` stage marker before autonomous implementation work
- **THEN** marked turn usage is attributed to `opsx-apply` with source `declared`

#### Scenario: autonomous ship runs CLI
- **WHEN** an assistant invokes a recognized `openspec-ops ship <change>` shell command without a slash invocation
- **THEN** subsequent usage in that agent invocation is attributed to `ops-ship` with source `observed`

#### Scenario: helper command does not steal attribution
- **WHEN** an invocation is attributed to `opsx-propose`
- **AND** the agent runs `openspec status` or `openspec instructions`
- **THEN** the active activity remains `opsx-propose`

#### Scenario: unmarked autonomous editing
- **WHEN** an agent edits implementation files without a recognized input, marker, or workflow-boundary command
- **THEN** usage remains `unknown`

### Requirement: Activity context is bounded to one agent invocation
An observed or declared activity context SHALL remain active through the model/tool-loop turns of its current agent invocation and SHALL reset after `agent_settled`. A later independent natural-language user message MUST NOT inherit an earlier explore or lifecycle activity without a fresh mechanical signal.

#### Scenario: multi-tool propose invocation
- **WHEN** a propose invocation establishes `opsx-propose`
- **AND** the agent performs multiple tool and model turns before settling
- **THEN** those turns retain the propose context unless a higher-precedence valid marker or workflow boundary replaces it

#### Scenario: later explore conversation has no fresh boundary
- **WHEN** an explore invocation settles
- **AND** the operator later sends ordinary natural-language follow-up without a recognized signature or marker
- **THEN** the new invocation begins as `unknown`

### Requirement: Attribution precedence is deterministic
For a recorded assistant turn, a valid structured stage marker SHALL own that marked turn; otherwise the latest recognized workflow-boundary shell signal SHALL take precedence over invocation-seeding input, and absence of all valid signals SHALL produce `unknown`. Invalid markers or signatures MUST NOT overwrite a valid current context.

#### Scenario: marker refines an observed invocation
- **WHEN** input seeded `opsx-explore`
- **AND** a valid `opsx-propose` stage marker appears on a later assistant turn in the same invocation
- **THEN** the marked turn is attributed to `opsx-propose` with source `declared`

#### Scenario: invalid marker is ignored
- **WHEN** a malformed or unsupported metrics marker appears
- **THEN** it does not replace the active valid activity context

### Requirement: Stage attribution and deliver reliability remain distinct
Turn-level activities from autonomous deliver-like execution MAY be attributed through markers and recognized shell commands, but the system SHALL create `deliver_attempt` start/settled reliability records only from the extension-owned `/ops-deliver` entrypoint. Metrics attribution MUST NOT imply merge consent.

#### Scenario: autonomous pipeline stages without deliver entrypoint
- **WHEN** an agent autonomously performs start, propose, or ship with recognizable signals
- **AND** no extension-owned `/ops-deliver` invocation occurred
- **THEN** applicable turn records are attributed to their stages
- **AND** no complete deliver attempt is fabricated

#### Scenario: extension-owned deliver retains reliability records
- **WHEN** `/ops-deliver <change>` is accepted by the guided extension
- **THEN** deliver attempt reliability recording continues with start and settled outcomes

### Requirement: Expanded activities remain storage and report compatible
JSONL validation, SQLite ingestion, and JSONL/SQLite reports SHALL accept and aggregate the expanded activity identifiers while retaining legacy record readability, idempotent projection, bounded labels, and explicit unknown coverage. Existing historical `unknown` records MUST NOT be retroactively reclassified from stored or conversational content.

#### Scenario: new activity syncs to SQLite
- **WHEN** retained JSONL contains valid `opsx-explore` and `opsx-sync` turn records
- **AND** the operator explicitly runs database sync
- **THEN** the records are ingested idempotently and report under their activity rows

#### Scenario: legacy unknown remains unknown
- **WHEN** an older retained turn is stored with action `unknown`
- **THEN** reports continue to count it as unknown
- **AND** do not inspect historical prose to reclassify it
