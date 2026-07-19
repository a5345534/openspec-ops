## MODIFIED Requirements

### Requirement: Deliver does not enable primary sync by default
`/ops-deliver` MUST NOT pass `--sync-primary`, `--sync-submodules`, `--attach-submodule-main`, or `--return-to-main` to finish when the effective `finish.return-to-main` policy is `off`. When the effective policy is `required`, deliver SHALL pass the strict composite `--return-to-main` behavior at its final finish station.

#### Scenario: default deliver finish has no sync flags
- **WHEN** deliver runs finish with effective `finish.return-to-main=off`
- **THEN** finish is invoked without sync-primary, sync-submodules, attach-submodule-main, or return-to-main

#### Scenario: configured deliver requires return to main
- **WHEN** deliver reaches finish with effective `finish.return-to-main=required`
- **THEN** it invokes finish with `--return-to-main`
- **AND** it does not report lifecycle completion unless strict closeout succeeds

#### Scenario: strict closeout needs human
- **WHEN** configured deliver receives `return_to_main_needs_human` from finish
- **THEN** deliver hard-stops with the structured primary/submodule diagnostics
- **AND** it does not force, retry destructively, or claim local return-to-main success
