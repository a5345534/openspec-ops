## 1. Config and policy

- [x] 1.1 Extend pi-config: `impl-review.max-rounds` + env `OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS`; tests for precedence
- [x] 1.2 Add `parseAutoImplReviewPolicy` default **on**; unit tests
- [x] 1.3 Inject impl-review max-rounds in config injection text

## 2. Skill and ship handoff

- [x] 2.1 Add ops-impl-review skill + prompt (post-ship loop, specs/tasks/diff/tests, fix+commit+push no force, max rounds; no second PR; no re-ship to re-arm)
- [x] 2.2 Update ops-ship skill/prompt: after success, if AUTO_IMPL_REVIEW on (default) → run `/ops-impl-review <change>` (v1 skill-level handoff; no extension required)
- [x] 2.3 Skip extension ship-parse hook in v1 unless already trivial

## 3. Docs and verification

- [x] 3.1 README: loop ship → ops-impl-review → merge; auto default on + off switch; ops-config key; risk note (code push)
- [x] 3.2 package.json files list includes ops-impl-review skill/prompt if explicit listing used
- [x] 3.3 Tests green; no auto-merge; no force push
