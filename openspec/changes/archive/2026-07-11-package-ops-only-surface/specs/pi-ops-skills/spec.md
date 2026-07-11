## MODIFIED Requirements

### Requirement: Four paired Pi skills and slash prompts exist
The project SHALL provide Pi skills and matching slash prompts for workspace lifecycle orchestration under the **ops-** prefix only for package export:

| Skill directory | Prompt file | CLI command |
|---|---|---|
| `.pi/skills/ops-start/` | `.pi/prompts/ops-start.md` | `openspec-ops start` |
| `.pi/skills/ops-where/` | `.pi/prompts/ops-where.md` | `openspec-ops where` |
| `.pi/skills/ops-finish/` | `.pi/prompts/ops-finish.md` | `openspec-ops finish` |
| `.pi/skills/ops-doctor/` | `.pi/prompts/ops-doctor.md` | `openspec-ops doctor` |

Additional package-exported skills (e.g. `ops-review`) MUST also use the `ops-` prefix.

The Pi package export surface MUST NOT include skills named `openspec-*` or prompts named `opsx-*`.

#### Scenario: Skill layout present for ops lifecycle
- **WHEN** the change is implemented
- **THEN** the four lifecycle skill directories and prompt files listed above exist for product use

#### Scenario: Package export excludes openspec and opsx names
- **WHEN** inspecting package.json `pi.skills` and `pi.prompts`
- **THEN** exported paths do not load `openspec-*` skills or `opsx-*` prompts
