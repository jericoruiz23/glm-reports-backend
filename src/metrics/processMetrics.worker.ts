import { KPI_RULE_SET_VERSION_V1 } from "./kpi.contract";
import { computeProcessMetrics } from "./processMetrics.compute";
import { buildProcessFingerprint } from "./processFingerprint";
import ProcessMetrics from "../models/processMetrics.model";
import { Process } from "../models/controlimport.model";
import { ProcessMetricsQueueDoc, ProcessSlaInput } from "./processMetrics.types";
import { Types } from "mongoose";

type RunOneStatus =
    | "idle"
    | "fresh"
    | "stale_requeued"
    | "error";

export interface RunOneMetricsJobResult {
    processed: boolean;
    status: RunOneStatus;
    processId?: string;
    message?: string;
}

export interface ProcessMetricsQueueHealth {
    staleCount: number;
    calculatingCount: number;
    freshCount: number;
    errorCount: number;
    freshRate: number;

    minutesSinceLastCalculatedAt: number | null;
    lastCalculatedAt: Date | null;
    maxFreshAgeMinutes: number | null;
}

const processClaimedMetricsDoc = async (
    claimed: ProcessMetricsQueueDoc
): Promise<RunOneMetricsJobResult> => {
    const processId = String(claimed?.processId ?? "");
    const startedAt = Date.now();
    try {

        const processDoc = (await Process.findById(claimed.processId).lean()) as ProcessSlaInput | null;

        if (!processDoc) {

            await ProcessMetrics.findOneAndUpdate(
                { _id: claimed._id, status: "calculating" },
                {
                    $set: {
                        status: "error",
                        lastError: "Process not found",
                    },
                }
            );

            return {
                processed: true,
                status: "error",
                processId,
                message: "Process not found",
            };
        }

        const recalculatedFingerprint = buildProcessFingerprint(processDoc);

        if (recalculatedFingerprint !== claimed.processFingerprint) {

            await ProcessMetrics.findOneAndUpdate(
                { _id: claimed._id, status: "calculating" },
                {
                    $set: {
                        status: "stale",
                        processFingerprint: recalculatedFingerprint,
                        processUpdatedAt: processDoc.updatedAt ?? new Date(),
                        processType:
                            typeof processDoc?.proceso === "string"
                                ? processDoc.proceso
                                : "",
                        lastError: null,
                    },
                }
            );

            return {
                processed: true,
                status: "stale_requeued",
                processId,
                message: "Fingerprint changed during calculation",
            };
        }

        const computed = computeProcessMetrics(
            processDoc,
            claimed.ruleSetVersion ?? KPI_RULE_SET_VERSION_V1
        );

        await ProcessMetrics.findOneAndUpdate(
            { _id: claimed._id, status: "calculating" },
            {
                $set: {
                    kpis: computed.kpis,
                    summary: computed.summary,
                    ruleSetVersion: computed.ruleSetVersion,
                    status: "fresh",
                    calculatedAt: new Date(),
                    lastError: null,
                    retryCount: 0,
                },
            }
        );

        const result: RunOneMetricsJobResult = {
            processed: true,
            status: "fresh",
            processId,
        };
        console.log(
            JSON.stringify({
                scope: "process_metrics_worker",
                processId,
                ruleSetVersion: claimed.ruleSetVersion ?? KPI_RULE_SET_VERSION_V1,
                status: result.status,
                durationMs: Date.now() - startedAt,
            })
        );
        return result;
    } catch (error: unknown) {

        const message =
            error instanceof Error ? error.message : "Unknown worker error";
        await ProcessMetrics.findOneAndUpdate(
            { _id: claimed._id, status: "calculating" },
            {
                $set: {
                    status: "error",
                    lastError: message,
                },
            }
        );

        const result: RunOneMetricsJobResult = {
            processed: true,
            status: "error",
            processId,
            message,
        };
        console.log(
            JSON.stringify({
                scope: "process_metrics_worker",
                processId,
                ruleSetVersion: claimed.ruleSetVersion ?? KPI_RULE_SET_VERSION_V1,
                status: result.status,
                durationMs: Date.now() - startedAt,
                error: message,
            })
        );
        return result;
    }
};

export const runOneMetricsJob = async (): Promise<RunOneMetricsJobResult> => {

    const claimed = await ProcessMetrics.findOneAndUpdate(
        {
            status: "stale",
        },
        {
            $set: {
                status: "calculating",
                lastError: null,
            },
        },
        {
            sort: { updatedAt: 1 },
            new: true,
        }
    ).lean();

    if (!claimed) {
        return {
            processed: false,
            status: "idle",
            message: "No stale jobs available",
        };
    }

    return processClaimedMetricsDoc(claimed as unknown as ProcessMetricsQueueDoc);
};

export const runMetricsJobForProcessId = async (
    processId: string,
    ruleSetVersion?: string
): Promise<RunOneMetricsJobResult> => {

    const query: Record<string, unknown> = {
        processId,
        status: "stale",
    };
    if (ruleSetVersion) query.ruleSetVersion = ruleSetVersion;

    const claimed = await ProcessMetrics.findOneAndUpdate(
        query,
        {
            $set: {
                status: "calculating",
                lastError: null,
            },
        },
        {
            sort: { updatedAt: 1 },
            new: true,
        }
    ).lean();

    if (!claimed) {
        return {
            processed: false,
            status: "idle",
            processId,
            message: "No stale metrics found for requested processId",
        };
    }

    return processClaimedMetricsDoc(claimed as unknown as ProcessMetricsQueueDoc);
};

export const runBatch = async (limit = 10): Promise<RunOneMetricsJobResult[]> => {
    const safeLimit =
        Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
    const results: RunOneMetricsJobResult[] = [];

    for (let i = 0; i < safeLimit; i++) {
        const result = await runOneMetricsJob();
        results.push(result);

        if (!result.processed && result.status === "idle") {
            break;
        }
    }

    const fresh = results.filter((r) => r.status === "fresh").length;
    const staleRequeued = results.filter((r) => r.status === "stale_requeued").length;
    const error = results.filter((r) => r.status === "error").length;
    console.log(
        `[process_metrics][runBatch] total=${results.length} fresh=${fresh} stale_requeued=${staleRequeued} error=${error}`
    );

    return results;
};

// Consulta rápida de salud para operación de la cola.
export const getProcessMetricsQueueHealth =
    async (): Promise<ProcessMetricsQueueHealth> => {
        const [staleCount, calculatingCount, freshCount, errorCount, lastFreshDoc, oldestFreshDoc] = await Promise.all([
            ProcessMetrics.countDocuments({
                status: "stale",
            }),
            ProcessMetrics.countDocuments({
                status: "calculating",
            }),
            ProcessMetrics.countDocuments({
                status: "fresh",
            }),
            ProcessMetrics.countDocuments({
                status: "error",
            }),
            ProcessMetrics.findOne({
                status: "fresh",
                calculatedAt: { $ne: null },
            })
                .sort({ calculatedAt: -1 })
                .lean(),
            ProcessMetrics.findOne({
                status: "fresh",
                calculatedAt: { $ne: null },
            })
                .sort({ calculatedAt: 1 })
                .lean(),
        ]);

        const lastCalculatedAt = lastFreshDoc?.calculatedAt
            ? new Date(lastFreshDoc.calculatedAt)
            : null;

        const minutesSinceLastCalculatedAt = lastCalculatedAt
            ? Math.floor((Date.now() - lastCalculatedAt.getTime()) / 60000)
            : null;
        const oldestFreshCalculatedAt = oldestFreshDoc?.calculatedAt
            ? new Date(oldestFreshDoc.calculatedAt)
            : null;
        const maxFreshAgeMinutes = oldestFreshCalculatedAt
            ? Math.floor((Date.now() - oldestFreshCalculatedAt.getTime()) / 60000)
            : null;
        const denominator = freshCount + staleCount + calculatingCount + errorCount;
        const freshRate =
            denominator > 0
                ? Number(((freshCount / denominator) * 100).toFixed(2))
                : 0;

        return {
            staleCount,
            calculatingCount,
            freshCount,
            errorCount,
            freshRate,
            minutesSinceLastCalculatedAt,
            lastCalculatedAt,
            maxFreshAgeMinutes,
        };
    };

// Recupera documentos "calculating" atascados por crash/timeout y los retorna a stale.
export const recoverStuckCalculating = async (
    olderThanMinutes = 15,
    limit = 500
): Promise<number> => {
    const safeMinutes =
        Number.isFinite(olderThanMinutes) && olderThanMinutes > 0
            ? Math.floor(olderThanMinutes)
            : 15;
    const safeLimit =
        Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500;
    const threshold = new Date(Date.now() - safeMinutes * 60_000);

    const stuck = await ProcessMetrics.find(
        {
            status: "calculating",
            updatedAt: { $lt: threshold },
        },
        { _id: 1 }
    )
        .sort({ updatedAt: 1 })
        .limit(safeLimit)
        .lean();

    if (!stuck.length) return 0;

    const ids = stuck.map((doc) => doc._id);
    const result = await ProcessMetrics.updateMany(
        { _id: { $in: ids } },
        {
            $set: {
                status: "stale",
            },
        }
    );

    const modified = result.modifiedCount ?? 0;
    console.log(
        `[process_metrics][recover-stuck] recovered=${modified} thresholdMinutes=${safeMinutes}`
    );
    return modified;
};

// Reencola métricas en error de forma controlada para retry automático/manual.
export const requeueErrorMetricsForRetry = async (
    maxRetries = 3,
    limit = 100,
    ruleSetVersion?: string
): Promise<number> => {
    const safeMaxRetries =
        Number.isFinite(maxRetries) && maxRetries >= 0 ? Math.floor(maxRetries) : 3;
    const safeLimit =
        Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;

    const query: Record<string, unknown> = {
        status: "error",
        retryCount: { $lt: safeMaxRetries },
    };
    // Si se envía versión, restringe; si no, aplica a todas las versiones activas/históricas.
    if (ruleSetVersion) query.ruleSetVersion = ruleSetVersion;

    const candidates = await ProcessMetrics.find(
        query,
        { _id: 1 }
    )
        .sort({ updatedAt: 1 })
        .limit(safeLimit)
        .lean();

    if (!candidates.length) {
        console.log(
            `[process_metrics][retry] requeued=0 maxRetries=${safeMaxRetries} limit=${safeLimit}`
        );
        return 0;
    }

    const ids = candidates.map((c) => c._id as Types.ObjectId);

    const result = await ProcessMetrics.updateMany(
        { _id: { $in: ids } },
        {
            $set: {
                status: "stale",
                lastError: null,
            },
            // El retryCount incrementa cuando se agenda un nuevo intento.
            // Esto hace que maxRetries sea exacto (1 incremento por retry real).
            $inc: { retryCount: 1 },
        }
    );

    const modified = result.modifiedCount ?? 0;
    console.log(
        `[process_metrics][retry] requeued=${modified} maxRetries=${safeMaxRetries} limit=${safeLimit} ruleSetVersion=${ruleSetVersion ?? "ALL"}`
    );
    return modified;
};
