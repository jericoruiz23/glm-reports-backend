# Metrics Runbook

## Purpose
Operational guide for `process_metrics` queue health, retries, and recovery.

## Key Health Signals
- `staleCount`: pending recompute queue size.
- `errorCount`: failed jobs waiting for retry/manual action.
- `freshRate`: `% fresh` across metrics docs.
- `minutesSinceLastCalculatedAt`: recency of latest successful compute.
- `maxFreshAgeMinutes`: oldest fresh snapshot age.

Endpoint:
- `GET /api/process/metrics/health` (admin)

## Standard Operating Cycle
1. Run worker continuously or via cron/job:
   - `npm run metrics:worker`
   - Ensure only one active execution window (lock enabled by `METRICS_WORKER_LOCK_TTL_MS`).
2. Verify queue health:
   - `GET /api/process/metrics/health`
3. Requeue errors when below retry policy threshold:
   - `POST /api/process/metrics/retry-errors`

## Incident: Stale Queue Growing
1. Check health endpoint and worker logs.
2. Increase worker frequency/concurrency.
3. Run controlled drain:
   - `npm run metrics:run`
4. Validate lock TTL and scheduler overlap behavior.
4. If needed, requeue by filter:
   - `POST /api/process/metrics/recalculate-by-filter`

## Incident: High Error Rate
1. Inspect latest `lastError` from metrics docs.
2. Validate active ruleset and source data integrity.
3. Requeue with controlled retries:
   - `POST /api/process/metrics/retry-errors`
4. If rule issue, activate previous stable rule set.

## Incident: Stuck Calculating
1. Worker runner auto-recovers stale from old `calculating`.
2. Validate `METRICS_WORKER_STUCK_MINUTES`.
3. Trigger worker batch:
   - `npm run metrics:worker`

## Backfill / Recovery
1. Mark all historical processes stale:
   - `npm run metrics:backfill`
2. Drain queue:
   - `npm run metrics:run`
3. Cleanup orphans if necessary:
   - `npm run metrics:cleanup-orphans`

## Staging Go-Live Rehearsal
1. `npm run metrics:backfill`
2. `npm run metrics:run`
3. Validate:
   - `GET /api/process/metrics/health`
   - `GET /api/process/metrics/legacy-usage?days=7`
4. Execute E2E flows:
   - create/update/anular/deleteItem -> stale -> fresh
   - force error -> retry
   - stuck calculating -> recover
   - activate new ruleSet -> recalculate and verify version
