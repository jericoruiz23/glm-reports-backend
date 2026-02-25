import "dotenv/config";
import { connectDB } from "./db";
import {
    getProcessMetricsQueueHealth,
    requeueErrorMetricsForRetry,
    recoverStuckCalculating,
    runBatch,
} from "../metrics/processMetrics.worker";
import {
    acquireMetricsWorkerLock,
    releaseMetricsWorkerLock,
} from "../metrics/workerLock.service";

// Runner operativo para ejecutar lotes del worker desde cron/job scheduler.
const main = async () => {
    // Prioridad: CLI args > env vars > defaults.
    const limit = Number(
        process.argv[2] ?? process.env.METRICS_WORKER_BATCH_SIZE ?? 100
    );
    const maxRetries = Number(
        process.argv[3] ?? process.env.METRICS_WORKER_MAX_RETRIES ?? 3
    );
    const retryLimit = Number(
        process.argv[4] ?? process.env.METRICS_WORKER_RETRY_LIMIT ?? 100
    );
    const stuckMinutes = Number(
        process.argv[5] ?? process.env.METRICS_WORKER_STUCK_MINUTES ?? 15
    );
    const stuckLimit = Number(
        process.argv[6] ?? process.env.METRICS_WORKER_STUCK_LIMIT ?? 500
    );
    const lockTtlMs = Number(
        process.env.METRICS_WORKER_LOCK_TTL_MS ?? 120_000
    );

    await connectDB();

    console.log(
        `[metrics:worker] config batch=${limit} maxRetries=${maxRetries} retryLimit=${retryLimit} stuckMinutes=${stuckMinutes} stuckLimit=${stuckLimit} lockTtlMs=${lockTtlMs}`
    );

    // Previene solapamiento entre jobs concurrentes.
    const lockAcquired = await acquireMetricsWorkerLock(lockTtlMs);
    if (!lockAcquired) {
        console.log("[metrics:worker] skipped: another worker lock is active");
        return;
    }

    try {
        // Primero recupera trabajos calculating potencialmente atascados.
        await recoverStuckCalculating(stuckMinutes, stuckLimit);

        // Política controlada: primero reencolar errores reintentables.
        await requeueErrorMetricsForRetry(maxRetries, retryLimit);

        // Luego procesar lote normal de stale.
        const results = await runBatch(limit);
        const health = await getProcessMetricsQueueHealth();

        console.log("[metrics:worker] batch results:", results);
        console.log("[metrics:worker] queue health:", health);
    } finally {
        await releaseMetricsWorkerLock();
    }
};

main()
    .then(() => {
        process.exitCode = 0;
    })
    .catch((error) => {
        console.error("[metrics:worker] fatal error:", error);
        process.exitCode = 1;
    });
