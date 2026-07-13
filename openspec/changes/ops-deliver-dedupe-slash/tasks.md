## 1. Remove colliding prompt

- [x] 1.1 Delete `.pi/prompts/ops-deliver.md`
- [x] 1.2 Remove from `package.json` `files`
- [x] 1.3 Update package-export test if it asserted deliver prompt

## 2. Docs / skill

- [x] 2.1 Skill: slash is extension-owned; skill is agent/`/skill:ops-deliver`
- [x] 2.2 README: note single slash after update

## 3. Verify

- [x] 3.1 Tests green; extension `registerCommand("ops-deliver")` still present
