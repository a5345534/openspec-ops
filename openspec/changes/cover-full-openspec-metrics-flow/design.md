## Context

Metrics collection is turn-based and already records Pi-reported model usage whenever metrics are enabled. Attribution context is currently derived from a narrow slash regex, selected shell commands, or sidecar-owned metrics markers, then reset at `agent_settled`. `MetricsAction` is structurally coupled to `NextActionId`, so activities outside the delivery state machine—especially `opsx-explore` and `opsx-sync`—cannot be represented. Pi may expand consumer prompt/skill commands before the extension's `input` hook sees them, so matching only raw slash text cannot cover stock OpenSpec surfaces.

The package must remain a pure sidecar: it cannot register, wrap, rename, or replace consumer-owned `openspec-*`/`opsx-*` resources. Collection must remain local, opt-in, content-free, model-free, fail-open, and backward-compatible with retained schema-v1/v2 JSONL and SQLite projections.

## Goals / Non-Goals

**Goals:**

- Attribute enabled model usage across the supported OpenSpec discovery, planning, implementation, synchronization, archive, and openspec-ops delivery/closeout activities.
- Recognize raw slash input, expanded stock prompt/skill input, valid stage markers, and known shell commands mechanically.
- Cover autonomous agent actions when they emit a marker or execute a recognized command.
- Keep activity context bounded to a single agent invocation while covering all model/tool-loop turns before `agent_settled`.
- Preserve `unknown` as an honest bucket and expose coverage rather than semantically guessing.

**Non-Goals:**

- Infer activity from arbitrary natural-language conversation with an LLM or heuristic topic classifier.
- Treat every `openspec status`, `instructions`, `validate`, or file edit as a separate workflow stage.
- Keep `opsx-explore` sticky across later independent user messages without a fresh mechanical signal.
- Create a deliver reliability attempt when the model autonomously follows deliver instructions without the extension-owned `/ops-deliver` entrypoint.
- Modify or publish consumer OpenSpec prompts/skills as part of the openspec-ops package surface.

## Decisions

### Separate metrics activity taxonomy from navigation actions

Introduce an independent activity union containing the existing lifecycle actions plus `opsx-explore` and `opsx-sync`. `/ops-next` stations and legal edges remain unchanged. This models discovery and synchronization without pretending they are mandatory delivery stations.

Alternative: add explore/sync to `NextActionId`. Rejected because it changes navigation semantics and legal-edge menus for a reporting concern.

### Recognize versioned stock prompt signatures in memory

Add a pure recognizer for raw slash forms and for high-entropy signatures from the vendored stock OpenSpec references (`opsx-explore`, propose, apply, sync, archive). A match sets activity context with `observed` attribution. The recognizer extracts a change only from an unambiguous bound location/argument that passes the existing kebab-case validator; otherwise change remains `null`.

The recognizer never persists input text, matched fragments, arguments, or confidence. Signature mismatch is fail-open to `unknown`. Tests bind supported signatures to the vendored reference fixtures so OpenSpec reference updates make drift visible.

Alternative: register wrapper commands for `opsx-*`. Rejected because it violates the pure-sidecar and consumer-authority boundaries. Alternative: inspect arbitrary prose semantically. Rejected for privacy, nondeterminism, and false attribution.

### Use explicit precedence and invocation-bounded lifetime

Attribution signals use this order for the turn they affect:

1. A valid structured stage marker (`declared`) owns the marked assistant turn.
2. The latest recognized shell lifecycle activity (`observed`) updates the active invocation context.
3. Recognized raw/expanded operator input (`observed`) seeds the invocation context.
4. Otherwise the context remains `unknown`.

The context persists through model/tool-loop turns of that agent invocation and resets at `agent_settled`. A later ordinary user message is therefore `unknown` unless it supplies a new signal. This avoids stale explore attribution while still capturing autonomous multi-tool work after a recognized command.

### Keep helper commands subordinate to the active activity

`openspec status`, `instructions`, `validate`, `show`, and similar helper commands do not replace the current activity bucket. Only workflow-boundary commands and signatures establish activity. This keeps reports focused on phase cost instead of low-level CLI frequency.

### Distinguish stage coverage from deliver-attempt reliability

Autonomous stage execution may produce correctly attributed turn records, but only the extension-owned `/ops-deliver` handler creates `deliver_attempt` start/settled records and carries merge consent. Reports and documentation state this distinction explicitly.

### Preserve metrics schema compatibility

The existing record structure remains sufficient; broaden validation to accept the new activity identifiers without changing stored content. SQLite continues storing normalized indexed columns plus the validated payload and requires explicit sync. Existing records remain readable; old `unknown` records are not retroactively reclassified.

## Risks / Trade-offs

- **Stock OpenSpec wording changes** → version signatures against vendored references, test drift, and fail to `unknown` rather than misattribute.
- **Expanded prompts contain arbitrary operator prose** → use only fixed high-entropy structural anchors and never persist inspected input.
- **Ordinary text accidentally resembles a stock prompt** → require multiple structural anchors or exact leading signatures, not generic phrases.
- **Autonomous work starts before its first marker/tool command** → earlier usage remains `unknown`; do not backfill or infer retrospectively.
- **Explore continuation across separate user messages remains unknown** → accept conservative under-attribution; a future upstream machine-readable activity boundary can improve this safely.

## Migration Plan

Ship as an additive taxonomy/recognizer update. Existing JSONL and SQLite databases require no destructive migration; a normal explicit `/ops-metrics db sync` projects new records. Rollback simply returns new activity values to unsupported/unknown handling in the older package, while retained source data remains local.
