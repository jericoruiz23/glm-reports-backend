import "dotenv/config";
import { connectDB } from "./db";
import { Process } from "../models/controlimport.model";
import { markProcessMetricsStale } from "../metrics/processMetrics.service";
import {
    getProcessMetricsQueueHealth,
    runBatch,
} from "../metrics/processMetrics.worker";

type CommandMode = "backfill" | "run" | "rebuild";

// Marca histórico completo como stale para encolar recálculo.
const markHistoricalAsStale = async (batchLogEvery = 200) => {
    let total = 0;

    // Cursor para no cargar toda la colección en memoria.
    const cursor = Process.find().sort({ _id: 1 }).cursor();

    for await (const processDoc of cursor) {
        await markProcessMetricsStale(processDoc);
        total += 1;

        if (total % batchLogEvery === 0) {
            console.log(`[metrics:backfill] marked stale: ${total}`);
        }
    }

    console.log(`[metrics:backfill] completed. total marked stale: ${total}`);
};

// Procesa la cola stale hasta agotarla.
const runUntilQueueDrains = async (batchSize = 100) => {
    let rounds = 0;
    let totalProcessed = 0;
    let totalFresh = 0;
    let totalRequeued = 0;
    let totalError = 0;

    while (true) {
        rounds += 1;
        const results = await runBatch(batchSize);
        const processedInRound = results.filter((r) => r.processed).length;
        totalProcessed += processedInRound;
        totalFresh += results.filter((r) => r.status === "fresh").length;
        totalRequeued += results.filter((r) => r.status === "stale_requeued").length;
        totalError += results.filter((r) => r.status === "error").length;

        const health = await getProcessMetricsQueueHealth();
        console.log(
            `[metrics:run] round=${rounds} processed=${processedInRound} stale=${health.staleCount} error=${health.errorCount}`
        );

        // Cuando no hay stale pendiente, la corrida terminó.
        if (health.staleCount === 0) break;
    }

    console.log(
        `[metrics:run] completed. processed=${totalProcessed} fresh=${totalFresh} stale_requeued=${totalRequeued} error=${totalError}`
    );
};

const main = async () => {
    const modeArg = String(process.argv[2] ?? "backfill").toLowerCase();
    const mode: CommandMode =
        modeArg === "run"
            ? "run"
            : modeArg === "rebuild"
                ? "rebuild"
                : "backfill";

    await connectDB();

    if (mode === "backfill") {
        await markHistoricalAsStale();
    } else if (mode === "run") {
        await runUntilQueueDrains();
    } else {
        console.log("[metrics:rebuild] marking historical processes as stale...");
        await markHistoricalAsStale();
        console.log("[metrics:rebuild] draining stale queue...");
        await runUntilQueueDrains();
    }

    const health = await getProcessMetricsQueueHealth();
    console.log("[metrics] health snapshot:", health);
    process.exit(0);
};

main().catch((error) => {
    console.error("[metrics] fatal error:", error);
    process.exit(1);
});
