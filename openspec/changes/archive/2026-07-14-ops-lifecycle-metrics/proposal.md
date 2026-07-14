## Why

openspec-ops has explicit lifecycle actions, mandatory review rounds, and deliver hard stops, but no quantitative evidence for three recurring decisions: where model/token cost is spent, whether later review rounds add value, and where `/ops-deliver` is unreliable. Optimizing models or orchestration without those measurements risks over-engineering.

## What Changes

- Add local, opt-in lifecycle metrics with no remote telemetry and no additional LLM calls.
- Mechanically collect per-action model usage (`input`, `output`, cache read/write, reasoning, cost, context pressure) from Pi turn events.
- Record structured spec-review and impl-review round outcomes (new majors/minors, verified fixes, verdict) without storing finding text.
- Record deliver attempts, resumes, start/end stations, completion/hard-stop outcomes, and stable error codes.
- Provide a deterministic `/ops-metrics` command for status, reporting, JSON export, and reset.
- Report attribution coverage and preserve unknown/unclassified usage instead of using an LLM to infer stages.
- Keep metrics failures fail-open: lifecycle behavior MUST remain unchanged if collection or reporting fails.

## Capabilities

### New Capabilities

- `ops-lifecycle-metrics`: local collection and deterministic reporting for model/cost, review-round yield, and deliver reliability.

### Modified Capabilities

<!-- None. Metrics observe existing lifecycle contracts without changing their gates or action semantics. -->

## Impact

- Pi guided extension gains metrics hooks and `/ops-metrics`.
- New dependency-free metrics domain/storage/report modules under `src/`.
- Review and deliver skills gain a structured marker contract for attribution/result counts; no extra model invocation or telemetry tool.
- Local metadata is stored outside project repositories under the Pi agent directory; prompt, source, tool arguments/results, and assistant text are not persisted.
