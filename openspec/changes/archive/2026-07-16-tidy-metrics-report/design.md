## Context

`formatMetricsReport` currently concatenates pipe-delimited rows without padding, omits usage totals from the rendered output, mixes semicolon-delimited reliability values, and labels monetary columns only as `cost`. Pi provider adapters derive those monetary values from provider-reported token counts and the selected model's registry rates; openspec-ops merely persists and aggregates them. The stored schema has numeric cost fields but no availability or provenance bit, so a zero value cannot distinguish missing rates from a genuinely zero rate.

The report is rendered directly in a Pi notification, where Markdown table behavior is unreliable and horizontal space is limited. JSONL and SQLite both feed the same `MetricsReport` formatter.

## Goals / Non-Goals

**Goals:**

- Produce deterministic, aligned plain-text tables that remain readable in the Pi TUI.
- Include totals and consistent token, percentage, context, and USD formatting.
- State accurate cost provenance and the ambiguity of zero-valued estimates.
- Keep JSONL and SQLite output structurally identical apart from source metadata.
- Cover exact report layout and edge cases with tests.

**Non-Goals:**

- Recalculate pricing inside openspec-ops.
- Claim that estimates equal provider invoices or subscription charges.
- Add pricing snapshots or alter the metrics record schema.
- Change collection, aggregation, lifecycle behavior, or report generation into a model-driven operation.

## Decisions

### Use a small deterministic plain-text table formatter

The formatter will pad text columns left and numeric columns right using declared widths. Labels that exceed their width will be deterministically truncated with an ASCII marker so one unexpected model or action name cannot make the entire report unbounded. Section widths will target a compact notification rather than terminal-dependent sizing.

Markdown tables were rejected because Pi notifications do not guarantee Markdown table layout. Dynamically measuring all content was rejected because a single long identifier would widen every row and make output less predictable.

### Render totals and consistent units

Action and model sections will include a `TOTAL` row derived from `report.usage.total`. Token values use the existing compact `k`/`M` representation; percentages use one decimal place; money uses a dollar sign and four decimal places; unavailable percentages or context values use `n/a`. Cache-write, reasoning, and maximum context will be visible where useful rather than silently collected but omitted.

### Describe cost as a Pi estimate

The report header will state `Cost: USD estimate (Pi model-registry rates × provider token usage)` and add a compact note that `$0` can also mean unavailable or zero configured rates. This is more accurate than “provider-reported cost”: providers generally report token counts while Pi calculates cost before openspec-ops observes the turn.

The formatter will not infer a missing-cost count because existing records carry no provenance bit. Adding one would require a separate schema and collection change.

### Reuse one formatter for both storage sources

`formatMetricsReport` remains the single rendering path. SQLite source metadata remains a header field; table and total semantics do not vary by source. This prevents presentation drift between authoritative JSONL and the optional projection.

## Risks / Trade-offs

- [Long identifiers lose suffix detail when truncated] → Preserve a readable prefix and test truncation deterministically.
- [Four-decimal USD values can round very small estimates to zero] → Clearly label them estimates; retain the existing precision to avoid expanding the report.
- [Zero-cost ambiguity remains] → State the limitation explicitly and do not fabricate missing-cost coverage.
- [Exact-output tests may require intentional updates for future layout changes] → Centralize padding and formatting helpers and test representative complete sections.
