# Internal Changelog

## 2026-02-24 - Fase 8 GA Closure
- Retired `legacy=true` in `GET /api/process` (`410 Gone`).
- Removed legacy placeholders from process list responses (`metricasTransito` now GA-only shape).
- Ensured metrics endpoints return `contractVersion` in success/error payloads.
- Stopped maintaining `automatico.cumplimientoDemorraje` on new process saves.
- Updated README/ops docs to mark legacy as retired and document final cleanup command.

## 2026-02-24 - Metrics Contract Freeze (`2026.06.v1`)
- KPI materialization becomes primary read path for list/detail endpoints.
- Added runtime-governed SLA ruleset activation (`sla_rule_sets`).
- Added worker recovery/retry operations and queue health metrics.
- Added admin governance endpoints for rulesets and mass recalc.
- Added legacy retirement timeline for `legacy=true` and `automatico` compatibility field.
