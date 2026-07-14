## 1. Metrics domain and storage

- [x] 1.1 Define versioned turn, review-round, and deliver-attempt record types plus strict marker parsing
- [x] 1.2 Implement user-local opt-in configuration and per-session append-only JSONL storage with malformed-line tolerance
- [x] 1.3 Add unit tests for storage/config, privacy-safe records, and corrupt records

## 2. Deterministic aggregation and reports

- [x] 2.1 Implement A model/cost/cache/action aggregation with unknown bucket and attribution coverage
- [x] 2.2 Implement B review-round cost/new-major/ready/missing-summary aggregation
- [x] 2.3 Implement C deliver completion/resume/hard-stop/error aggregation
- [x] 2.4 Add text and JSON report/export formatting tests

## 3. Pi extension integration

- [x] 3.1 Register `/ops-metrics status|on|off|report|export|reset` with reset confirmation and no agent turn
- [x] 3.2 Collect enabled `turn_end` model usage/context against explicit or declared action context
- [x] 3.3 Track explicit slash/next/deliver contexts, tool outcomes, deliver attempts, and settled outcomes fail-open
- [x] 3.4 Add extension-safe helper tests proving collection errors do not affect lifecycle decisions

## 4. Structured skill markers

- [x] 4.1 Add hidden stage marker contract to ops-deliver without adding telemetry tool/model calls
- [x] 4.2 Add structured round/result marker contract to ops-spec-review skill/prompt
- [x] 4.3 Add structured round/result marker contract to ops-impl-review skill/prompt

## 5. Documentation and verification

- [x] 5.1 Document opt-in/local/privacy semantics, report fields, attribution coverage, and limitations
- [x] 5.2 Run OpenSpec validation, typecheck/build, and complete test suite
