## 1. Skill + docs

- [x] 1.1 Create `.pi/skills/ops-deliver/SKILL.md` + `.pi/prompts/ops-deliver.md` (pipeline, consent, mandatory reviews, resume, stops)
- [x] 1.2 Add package.json `files` entry for ops-deliver skill/prompt
- [x] 1.3 README: deliver vs next; explore out of scope; merge consent

## 2. Optional helper

- [x] 2.1 `defaultDeliverAction(station)` in `src/next-step/` + unit tests (table-driven)
- [x] 2.2 Skill references same table as code helper

## 3. Specs

- [x] 3.1 ADDED ops-deliver capability; guided-next-step / pi-ops-skills / loop-closure deltas
- [x] 3.2 package-export test includes ops-deliver in files if pattern requires explicit paths

## 4. Verify

- [x] 4.1 No skip-review flags; no force finish; tests green
