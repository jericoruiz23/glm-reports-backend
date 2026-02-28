# GLM Reports Backend

## KPI Materialization Architecture
- `processes` (`Process` model) stores transactional/import form data.
- `process_metrics` (`ProcessMetrics` model) stores materialized KPIs by `processId + ruleSetVersion`.
- Active rule set version is configurable at runtime via `sla_rule_sets`.

## State Machine (`process_metrics`)
- `stale`: waiting for recompute.
- `calculating`: claimed by worker.
- `fresh`: materialized KPI payload ready for read.
- `error`: compute failed; `lastError` populated.

Flow:
1. Process mutation marks metrics as `stale`.
2. Worker claims (`stale -> calculating`).
3. Worker computes and writes (`fresh`) or fails (`error`).
4. If fingerprint changed during compute, worker requeues to `stale`.

## API Usage
- Contract freeze:
  - Contract version: `2026.06.v1`
  - Legacy mode retired on: `2026-02-24`

- List processes (operational data only):
  - `GET /api/process`
  - Supports: `page`, `limit`, `processType`, `estado`, `from`, `to`
  - Returns only process operational data. It does not include `metricasTransito` or `cumplimientoDemorraje`.
  - `legacy=true` now returns `410 Gone`
- Official KPI source (`fuente oficial KPI`):
  - `GET /api/process/metrics`
  - Includes materialized KPI rows plus `globalKpis` such as `TOTAL_CONTENEDORES_GLOBAL`.
- KPI detail for one process:
  - `GET /api/process/:id/metrics`
- Manual recalc for one process:
  - `POST /api/process/:id/metrics/recalculate`
  - Optional immediate run: `?runNow=true`

Admin operations:
- Queue health:
  - `GET /api/process/metrics/health`
- Legacy usage telemetry:
  - `GET /api/process/metrics/legacy-usage?days=7`
- Bulk requeue by filter:
  - `POST /api/process/metrics/recalculate-by-filter`
- Retry errored metrics:
  - `POST /api/process/metrics/retry-errors`
- Rule set governance:
  - `GET /api/process/metrics/rule-sets`
  - `POST /api/process/metrics/rule-sets`
  - `POST /api/process/metrics/rule-sets/:version/activate`
  - `POST /api/process/metrics/rule-sets/:version/deactivate`

## Operational Commands
- Backfill historical stale:
  - `npm run metrics:backfill`
- Drain stale queue:
  - `npm run metrics:run`
- Scheduler-friendly worker batch:
  - `npm run metrics:worker`
  - Example cron (every minute): `* * * * * cd /app && npm run metrics:worker`
  - Non-overlap lock uses `METRICS_WORKER_LOCK_TTL_MS` (default 120000 ms).
- Cleanup orphan `process_metrics`:
  - `npm run metrics:cleanup-orphans`
- Cleanup legacy automatico field (optional):
  - `npm run metrics:cleanup-legacy-automatico` (`dry-run` by default; pass `false` to execute)

## Backfill / Recovery Procedure
1. Run stale backfill:
   - `npm run metrics:backfill`
2. Run worker until queue drains:
   - `npm run metrics:run`
3. Validate queue health:
   - `GET /api/process/metrics/health`
4. If errors remain, requeue controlled retries:
   - `POST /api/process/metrics/retry-errors`
5. If `calculating` gets stuck after crash, worker runner auto-recovers to `stale`
   using configured threshold (`METRICS_WORKER_STUCK_MINUTES`).

## Environment Parameters (Worker)
- `METRICS_WORKER_BATCH_SIZE` (default `100`)
- `METRICS_WORKER_MAX_RETRIES` (default `3`)
- `METRICS_WORKER_RETRY_LIMIT` (default `100`)
- `METRICS_WORKER_STUCK_MINUTES` (default `15`)
- `METRICS_WORKER_STUCK_LIMIT` (default `500`)
- `METRICS_WORKER_LOCK_TTL_MS` (default `120000`)

## Legacy Compatibility Notes
- Legacy runtime mode (`legacy=true`) is retired.
- `automatico.cumplimientoDemorraje` is deprecated and not maintained in new saves.
- Cleanup command for final removal after zero consumers validation:
  - `npm run metrics:cleanup-legacy-automatico false`

## Runbook
- Incident runbook: [`docs/metrics-runbook.md`](docs/metrics-runbook.md)
- Internal changes log: [`CHANGELOG_INTERNAL.md`](CHANGELOG_INTERNAL.md)
