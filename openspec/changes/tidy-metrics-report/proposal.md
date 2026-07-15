## Why

The current `/ops-metrics report` output is difficult to scan in Pi's narrow TUI and presents cost without explaining that Pi derives it from provider token counts and model-registry rates. A compact, consistently aligned report with explicit cost provenance will make lifecycle metrics easier to compare and harder to misinterpret.

## What Changes

- Render metrics reports as compact fixed-width plain-text sections with aligned labels, numeric columns, stable units, and totals.
- Label monetary values as USD estimates derived by Pi rather than provider invoices or openspec-ops pricing calculations.
- Expose the limitations of zero-valued cost data without claiming that zero proves a model is free.
- Keep JSONL and SQLite aggregation semantics identical and preserve mechanical, model-free reporting.
- Add deterministic formatting tests suitable for narrow Pi notifications.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ops-lifecycle-metrics`: Clarify and standardize human-readable report formatting, totals, units, and cost provenance.

## Impact

- Affects `src/lifecycle-metrics/report.ts`, the guided extension's report presentation, metrics documentation, and report-format tests.
- Does not change collection, stored record schemas, JSONL authority, SQLite projection behavior, or lifecycle execution.
