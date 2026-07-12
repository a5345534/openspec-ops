## ADDED Requirements

### Requirement: Docs warn about worktree archive vs primary residual
Recommended loop documentation SHALL state that default archive is on mainline after merge, and that archiving only on a worktree while leaving an active change directory on primary confuses status and may trigger wrong-phase spec-review.

#### Scenario: README mentions residual active footgun
- **WHEN** reading loop/archive documentation after this change
- **THEN** it mentions mainline archive preference or primary residual risk
