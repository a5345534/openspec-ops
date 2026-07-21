---
name: "Metrics cost comes from Pi/provider turn usage"
description: "Report cost aggregates each assistant turn’s Pi-reported `usage.cost.total`; it is not recomputed from a local model price table."
type: reference
scope: capability:ops-lifecycle-metrics
verified_at: 2026-07-21
source: agent:compact-producer
---

## Cost attribution basis

For each assistant turn, lifecycle metrics persist the raw usage object supplied by Pi/provider, including token counts and cost components:

- `usage.cost.input`
- `usage.cost.output`
- `usage.cost.cacheRead`
- `usage.cost.cacheWrite`
- `usage.cost.total`

Reports sum `usage.cost.total` by action/model and associate review-round cost with the corresponding recorded turns. The implementation does **not** independently calculate cost from model names and a local pricing table. Consequently, accuracy and currency semantics depend on what Pi/provider reports; unavailable or zero provider cost remains unavailable/zero rather than being guessed.

The model record can also contain `reasoningLevel`, while `usage.reasoning` is stored only when the provider/Pi reports reasoning-token usage. Hidden reasoning text is never stored.

## Evidence

- `RawUsage` shown in the conversation contains per-category `cost` fields and `total`.
- The report implementation reviewed in-session adds `turn.usage.cost.total` to aggregates.
- A real smoke run reported model cost directly from the Pi turn, while report rendering produced no additional model turn.

## Why this is shared

Users need this to interpret cost reports correctly and future changes must not silently mix provider-reported cost with locally estimated pricing.
