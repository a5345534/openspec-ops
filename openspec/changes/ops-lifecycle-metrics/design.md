## Context

Pi already exposes exact per-turn assistant usage (`input`, `output`, cache read/write, reasoning and cost), current model/context, and lifecycle hooks. openspec-ops already owns lifecycle action ids and station detection. The missing layer is a local correlation context that attributes Pi usage to actions/review rounds and links `/ops-deliver` attempts without copying conversation content.

The current `/ops-deliver` is skill-orchestrated: the extension knows the batch invocation, while the agent executes child actions. Therefore v1 must distinguish deterministic observations from skill-declared markers and report attribution coverage rather than claim perfect classification.

## Goals / Non-Goals

**Goals:**

- Mechanically collect model/cost/cache usage by lifecycle action.
- Quantify review-round marginal cost/yield and deliver reliability.
- Keep collection local, opt-in, content-free, dependency-free, and fail-open.
- Produce reports without invoking an LLM or adding a telemetry tool call.
- Preserve unknown/unattributed usage and expose coverage.

**Non-Goals:**

- Switch models, call an advisor, upload telemetry, or auto-tune max rounds.
- Store prompts, assistant prose, source, tool inputs/results, stderr, or secrets.
- Refactor the deliver skill into a code-owned orchestrator.
- Produce a composite agent productivity score or causal model comparison.

## Decisions

### 1. Use action spans, turn usage records, review summaries, and deliver attempts

A change is the correlation root. Each Pi turn records raw usage against the active action/round. Review summaries and deliver attempt outcomes are separate metadata-only records. Reports derive aggregates from versioned records.

Alternatives considered:

- Session-total snapshots: cannot attribute stages or rounds.
- Full transcript post-processing: sensitive, expensive, and nondeterministic.
- OpenTelemetry/export service: unnecessary for local v1.

### 2. Local opt-in config and per-session JSONL

Metrics default disabled. `/ops-metrics on|off` persists user-local preference under the Pi agent directory. Records are appended to one JSONL file per hashed Pi session under `~/.pi/agent/openspec-ops/metrics/` (or `PI_CODING_AGENT_DIR`). Per-session files avoid cross-process locks and remain inspectable/recoverable. Malformed lines are skipped during reporting.

No package/project checkout contains metrics data; no network request is made.

### 3. Deterministic hot path; no extra LLM or telemetry tool

The extension collects `turn_end` assistant usage and lifecycle/tool outcomes. `/ops-metrics` reports directly through UI. No `sendUserMessage`, model call, or agent-visible telemetry tool is used for reporting/collection.

Review and deliver skills MAY emit hidden HTML comment markers as part of their existing output, for example:

```text
<!-- ops-metrics:stage {"change":"x","action":"ops-spec-review","round":1} -->
<!-- ops-metrics:review {"change":"x","reviewType":"spec","round":1,"newMajors":2,"newMinors":1,"majorsFixed":2,"fixVerificationPassed":true,"verdict":"continue"} -->
```

Parsing/validation is mechanical. Missing/invalid markers remain unknown; a second model is never used to repair them.

### 4. Attribution has explicit provenance and coverage

- `observed`: extension command/input or recognized openspec-ops/OpenSpec command established the action.
- `declared`: validated structured skill marker established the action/round.
- `unknown`: no reliable context.

Every report shows attributed usage divided by all recorded usage. Unknown is a first-class bucket.

### 5. Preserve raw provider usage fields

Store raw `input`, `output`, `cacheRead`, `cacheWrite`, optional reasoning, cost components and context pressure. Provider cache semantics differ, so collection does not overwrite/relabel them. Reports calculate simple shares while retaining raw values.

### 6. Review-round result contract

Each full review round emits one structured summary with counts only: new majors/minors, majors fixed, in-round verification, and `continue|ready|needs_human`. Finding text is never stored. Missing summaries are reported, not inferred.

This records the reviewer model's existing judgment; it is not an additional evaluation model.

### 7. Deliver attempts settle mechanically

`/ops-deliver` creates an attempt id and captures start station. At `agent_settled`, finish success marks completed; a review `needs_human` marks needs-human; the most recent stable CLI error marks hard-stop; otherwise the attempt is incomplete. A later invocation for the same change is marked resume when an earlier incomplete/hard-stop attempt exists.

### 8. Reports target A+B+C only

- A: usage/cost/cache/context by action and model.
- B: per-round entry count, average cost, new-major rate, ready rate, missing summaries.
- C: attempts, first-invocation completion, resume count, hard-stop action/error distribution.

No automatic recommendation or config mutation is produced.

## Risks / Trade-offs

- **Skill markers can be omitted** → Preserve `unknown`, show attribution/result coverage, never infer with an LLM.
- **A turn can cross an action boundary** → Marker found in the completed assistant turn owns that turn; document this deterministic convention.
- **Deliver child attribution is imperfect** → Keep explicit overhead/unknown buckets; defer orchestrator rewrite.
- **Provider usage fields may be absent/inconsistent** → Store numbers as reported and track missing fields; report raw totals.
- **Metrics files may grow** → Metadata-only per-session files plus explicit reset/export; add retention only after real usage data.
- **Crash leaves an open attempt** → Reporter classifies unclosed attempt as incomplete.
- **Metrics bugs could affect lifecycle** → All collector/storage/report calls are caught; lifecycle paths never depend on metrics success.
- **Change names are local metadata** → Store locally in clear for useful reports; no remote export without explicit operator action.

## Migration Plan

1. Ship disabled by default; existing sessions/lifecycle remain unchanged.
2. Operator enables with `/ops-metrics on` and gathers records.
3. Disable or reset locally to roll back; no project data migration is required.

## Open Questions

- Whether v2 should add retention days or SQLite after real data volume is known.
- Whether deliver attribution coverage is high enough without moving orchestration into code.
