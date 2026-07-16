## 1. Language State and Contract

- [x] 1.1 Implement pure sticky response-language inference with script-aware Chinese handling, broad ISO 639-3 detection, and explicit switches.
- [x] 1.2 Observe genuine operator input while excluding extension-generated messages, commands, code-heavy, and ambiguous short input.
- [x] 1.3 Persist only changed locale codes in custom session entries and restore them after session start/reload/resume.
- [x] 1.4 Inject the active response-language contract before every agent turn while preserving technical literals.

## 2. Lifecycle Integration

- [x] 2.1 Bind the language contract into deferred `/ops-deliver` follow-ups.
- [x] 2.2 Align packaged ops skill instructions so English examples are translated semantically rather than copied.
- [x] 2.3 Document conversational-report scope and direct CLI/UI exclusions.

## 3. Verification

- [x] 3.1 Test Traditional/Simplified Chinese, Japanese, Korean, English, Spanish, sticky short input, explicit switching, and extension exclusion.
- [x] 3.2 Test per-turn injection, metadata restoration/privacy, and deliver handoff binding.
- [x] 3.3 Run OpenSpec validation, typecheck, build, targeted tests, full tests, and diff checks.
