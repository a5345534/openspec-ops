## 1. Teardown prepare

- [x] 1.1 After successful deinit (and for non-initialized leftover dirs listed in `.gitmodules`), clear residual paths safely
- [x] 1.2 Unit tests for residual clear + no wipe of still-initialized on deinit fail

## 2. Finish retry

- [x] 2.1 On containment error: re-prepare + single remove retry
- [x] 2.2 Unit test with mocked deps for retry success and double-fail

## 3. Verify

- [x] 3.1 Existing finish/submodule tests still green; locale containment still matched
