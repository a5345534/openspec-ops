## 1. Probe helper

- [x] 1.1 Add read-only top-level submodule probe (parse `.gitmodules` / list paths under worktree; detached, dirty, branch, head); design for injectability in tests
- [x] 1.2 Unit tests with injected/mocked probe inputs: no submodules → `[]`; detached clean; detached dirty; probe failure does not throw fatally (prefer inject over heavy nested git fixtures)

## 2. Doctor and lifecycle surfaces

- [x] 2.1 Doctor: emit `submodule_detached` (**info**) and `submodule_detached_dirty` (**warning**) with hints; do **not** add attached+dirty-only issue class
- [x] 2.2 Types: extend `DoctorIssue` id union; `WhereResult.submodules` required on success (`[]` ok)
- [x] 2.3 Where: always attach `submodules` array on success
- [x] 2.4 Finish: dirty refuse message **shall** mention possible submodule uncommitted work / force risk

## 3. Docs and skills

- [x] 3.1 README: parent vs submodule branch model + recommended commit order
- [x] 3.2 Snippet / alignment block: path alignment ≠ submodule branch; apply note when `.gitmodules` exists
- [x] 3.3 ops-start skill: detached HEAD warning bullet

## 4. Verification

- [x] 4.1 Tests green; no auto branch/commit implementation; no OpenSpec archive changes
- [x] 4.2 Doctor mapping test (injected probe): detached dirty → `submodule_detached_dirty` warning; clean detached → `submodule_detached` info
