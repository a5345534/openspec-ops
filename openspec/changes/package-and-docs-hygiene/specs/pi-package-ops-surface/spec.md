## ADDED Requirements

### Requirement: Package publishes ops-next skill
The npm/pi package `files` list SHALL include the ops-next skill directory so consumers receive guided next-step alongside other ops-* skills.

#### Scenario: files includes ops-next
- **WHEN** inspecting package.json `files` after this change
- **THEN** an entry covers `.pi/skills/ops-next` (or equivalent path)

### Requirement: Published dist does not ship deleted auto modules
After a clean production build, the package MUST NOT contain compiled modules under `dist/auto-ensure`, `dist/auto-review`, `dist/auto-finish`, or `dist/auto-impl-review` corresponding to removed source trees.

#### Scenario: no dist auto-ensure after build
- **WHEN** `npm run build` completes cleanly
- **THEN** `dist/auto-ensure` is absent
