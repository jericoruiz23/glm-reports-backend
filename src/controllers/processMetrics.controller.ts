import { Request, Response } from "express";
import { Types } from "mongoose";
import ProcessMetrics from "../models/processMetrics.model";
import {
    kpisArrayToMap,
    MaterializedKpiItem,
} from "../metrics/kpi.contract";
import { Process } from "../models/controlimport.model";
import { markProcessMetricsStale } from "../metrics/processMetrics.service";
import {
    getProcessMetricsQueueHealth,
    requeueErrorMetricsForRetry,
    runMetricsJobForProcessId,
} from "../metrics/processMetrics.worker";
import {
    activateRuleSetVersion,
    deactivateRuleSetVersion,
    getActiveRuleSetVersion,
    listRuleSets,
    upsertRuleSetVersion,
} from "../metrics/ruleSet.service";
import {
    METRICS_API_CONTRACT_VERSION,
    METRICS_LEGACY_RETIRED_ON,
} from "../metrics/metrics.contract";
import {
    auditMetricsAction,
    getLegacyUsageStats,
} from "../metrics/metricsAudit.service";
import { AuthRequest } from "../middlewares/auth.middleware";

// Auditoría no bloqueante: no debe frenar endpoints operativos.
const fireAndForgetAudit = (
    payload: Parameters<typeof auditMetricsAction>[0]
) => {
    void auditMetricsAction(payload).catch((error) => {
        console.error("metrics audit failed (non-blocking):", error);
    });
};

// GET /api/process/:id/metrics
// Lee métricas materializadas desde process_metrics (sin recálculo en vivo).
export const getProcessMetricsByProcessId = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "Invalid process id",
            });
        }

        const activeRuleSetVersion = await getActiveRuleSetVersion();
        const metrics = await ProcessMetrics.findOne({
            processId: id,
            ruleSetVersion: activeRuleSetVersion,
        }).lean();

        if (!metrics) {
            return res.status(404).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "Process metrics not found",
                processId: id,
                ruleSetVersion: activeRuleSetVersion,
            });
        }

        const status = metrics.status;
        const isStale = status === "stale" || status === "calculating";
        const isError = status === "error";

        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            processId: metrics.processId,
            ruleSetVersion: metrics.ruleSetVersion,
            status,
            stale: isStale,
            calculatedAt: metrics.calculatedAt ?? null,
            lastError: isError ? metrics.lastError ?? null : null,
            summary: metrics.summary ?? null,
            kpis: kpisArrayToMap(
                (Array.isArray(metrics.kpis) ? metrics.kpis : []) as MaterializedKpiItem[]
            ),
        });
    } catch (error) {
        console.error("Error fetching process metrics:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error fetching process metrics",
        });
    }
};

// POST /api/process/:id/metrics/recalculate
// Marca stale y opcionalmente ejecuta un job del worker.
export const recalculateProcessMetrics = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const body = req.body as { runNow?: boolean } | undefined;
        const runNowFromBody = Boolean(body?.runNow);
        const runNowFromQuery = String(req.query.runNow ?? "") === "true";
        const runNow = runNowFromBody || runNowFromQuery;

        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "Invalid process id",
            });
        }

        const processDoc = await Process.findById(id);
        if (!processDoc) {
            return res.status(404).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "Process not found",
            });
        }

        // 1) Siempre marcar stale para encolar recálculo.
        const activeRuleSetVersion = await markProcessMetricsStale(processDoc);

        // 2) Opcional: disparar un job inmediato para ESTE processId.
        let workerResult: any = null;
        if (runNow) {
            workerResult = await runMetricsJobForProcessId(id, activeRuleSetVersion);
        }

        fireAndForgetAudit({
            action: "recalculate_process_metrics",
            req: req as AuthRequest,
            processId: id,
            ruleSetVersion: activeRuleSetVersion,
            payload: { runNow },
        });

        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Process metrics marked as stale",
            processId: id,
            ruleSetVersion: activeRuleSetVersion,
            runNow,
            workerResult,
        });
    } catch (error) {
        console.error("Error recalculating process metrics:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error recalculating process metrics",
        });
    }
};

// POST /api/process/metrics/recalculate-by-filter
// Reencola procesos por filtros operativos (processType y rango de fechas).
export const recalculateProcessMetricsByFilter = async (
    req: Request,
    res: Response
) => {
    try {
        const body = req.body as {
            processType?: string;
            updatedFrom?: string;
            updatedTo?: string;
            limit?: number;
            runNow?: boolean;
            ruleSetVersion?: string;
        };

        const processType = body?.processType?.trim();
        const updatedFrom = body?.updatedFrom ? new Date(body.updatedFrom) : null;
        const updatedTo = body?.updatedTo ? new Date(body.updatedTo) : null;
        const runNow = Boolean(body?.runNow);
        const ruleSetVersionFilter = body?.ruleSetVersion
            ? String(body.ruleSetVersion).trim()
            : null;
        const limit =
            Number.isFinite(body?.limit) && (body?.limit as number) > 0
                ? Math.min(Math.floor(body?.limit as number), 5000)
                : 500;

        const query: Record<string, unknown> = {};
        if (processType) query.proceso = processType;
        if (updatedFrom || updatedTo) {
            query.updatedAt = {
                ...(updatedFrom ? { $gte: updatedFrom } : {}),
                ...(updatedTo ? { $lte: updatedTo } : {}),
            };
        }

        const processes = await Process.find(query).sort({ updatedAt: -1 }).limit(limit);

        let marked = 0;
        let runNowProcessed = 0;
        for (const processDoc of processes) {
            // Marca stale y obtiene versión exacta usada para ese proceso.
            const staleRuleSetVersion = await markProcessMetricsStale(processDoc);
            marked += 1;

            if (runNow) {
                const targetRuleSetVersion =
                    ruleSetVersionFilter ?? staleRuleSetVersion;
                // Ejecuta worker dirigido por processId + versión para evitar ambigüedad.
                const result = await runMetricsJobForProcessId(
                    String(processDoc._id),
                    targetRuleSetVersion
                );
                if (result.processed) runNowProcessed += 1;
            }
        }

        fireAndForgetAudit({
            action: "recalculate_process_metrics_by_filter",
            req: req as AuthRequest,
            ruleSetVersion: ruleSetVersionFilter ?? null,
            payload: {
                processType: processType ?? null,
                updatedFrom: updatedFrom?.toISOString() ?? null,
                updatedTo: updatedTo?.toISOString() ?? null,
                limit,
                runNow,
                marked,
            },
        });

        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Filtered process metrics recalculation queued",
            filter: {
                processType: processType ?? null,
                updatedFrom: updatedFrom?.toISOString() ?? null,
                updatedTo: updatedTo?.toISOString() ?? null,
                limit,
                ruleSetVersion: ruleSetVersionFilter,
            },
            marked,
            runNow,
            runNowProcessed,
        });
    } catch (error) {
        console.error("Error recalculating process metrics by filter:", error);
        return res
            .status(500)
            .json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "Error recalculating process metrics by filter",
            });
    }
};

// GET /api/process/metrics/health
// Devuelve snapshot rápido de salud de la cola de process_metrics.
export const getProcessMetricsHealth = async (req: Request, res: Response) => {
    try {
        const activeRuleSetVersion = await getActiveRuleSetVersion();
        const health = await getProcessMetricsQueueHealth();
        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            ruleSetVersion: activeRuleSetVersion,
            ...health,
        });
    } catch (error) {
        console.error("Error fetching process metrics health:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error fetching process metrics health",
        });
    }
};

// GET /api/process/metrics
// Lista materializados con paginación/filtros para operación/admin.
export const getProcessMetrics = async (req: Request, res: Response) => {
    try {
        const page = Math.max(Number(req.query.page ?? 1), 1);
        const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
        const skip = (page - 1) * limit;

        const status = String(req.query.status ?? "").trim();
        const ruleSetVersion = String(req.query.ruleSetVersion ?? "").trim();
        const processType = String(req.query.processType ?? "").trim();
        const processId = String(req.query.processId ?? "").trim();
        const updatedFrom = req.query.updatedFrom
            ? new Date(String(req.query.updatedFrom))
            : null;
        const updatedTo = req.query.updatedTo
            ? new Date(String(req.query.updatedTo))
            : null;

        const allowedStatus = new Set(["stale", "calculating", "fresh", "error"]);
        if (status && !allowedStatus.has(status)) {
            return res.status(400).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "Invalid status filter",
            });
        }

        if (processId && !Types.ObjectId.isValid(processId)) {
            return res.status(400).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "Invalid processId filter",
            });
        }

        const query: Record<string, unknown> = {};
        if (status) query.status = status;
        if (ruleSetVersion) query.ruleSetVersion = ruleSetVersion;
        if (processType) query.processType = processType;
        if (processId) query.processId = processId;
        if (updatedFrom || updatedTo) {
            query.updatedAt = {
                ...(updatedFrom ? { $gte: updatedFrom } : {}),
                ...(updatedTo ? { $lte: updatedTo } : {}),
            };
        }

        const [rows, total, activeRuleSetVersion] = await Promise.all([
            ProcessMetrics.find(query)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProcessMetrics.countDocuments(query),
            getActiveRuleSetVersion(),
        ]);

        const data = rows.map((item: any) => ({
            processId: item.processId,
            processType: item.processType ?? "",
            ruleSetVersion: item.ruleSetVersion,
            status: item.status,
            stale: item.status === "stale" || item.status === "calculating",
            calculatedAt: item.calculatedAt ?? null,
            lastError: item.status === "error" ? item.lastError ?? null : null,
            summary: item.summary ?? null,
            retryCount: Number(item.retryCount ?? 0),
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            kpis: kpisArrayToMap(
                (Array.isArray(item.kpis) ? item.kpis : []) as MaterializedKpiItem[]
            ),
        }));

        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            activeRuleSetVersion,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            filters: {
                status: status || null,
                ruleSetVersion: ruleSetVersion || null,
                processType: processType || null,
                processId: processId || null,
                updatedFrom: updatedFrom?.toISOString() ?? null,
                updatedTo: updatedTo?.toISOString() ?? null,
            },
            data,
        });
    } catch (error) {
        console.error("Error listing process metrics:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error listing process metrics",
        });
    }
};

// GET /api/process/metrics/legacy-usage?days=7
// Mide consumo de legacy=true para controlar plan de corte.
export const getLegacyUsage = async (req: Request, res: Response) => {
    try {
        const days = Number(req.query.days ?? 7);
        const stats = await getLegacyUsageStats(days);
        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            legacyRetiredOn: METRICS_LEGACY_RETIRED_ON,
            ...stats,
        });
    } catch (error) {
        console.error("Error fetching legacy usage stats:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error fetching legacy usage stats",
        });
    }
};

// POST /api/process/metrics/retry-errors
// Reencola errores en forma controlada para permitir retries.
export const retryErroredProcessMetrics = async (req: Request, res: Response) => {
    try {
        const body = req.body as {
            maxRetries?: number;
            limit?: number;
            ruleSetVersion?: string;
        } | undefined;
        const maxRetries = Number(body?.maxRetries ?? 3);
        const limit = Number(body?.limit ?? 100);
        const ruleSetVersion = body?.ruleSetVersion
            ? String(body.ruleSetVersion).trim()
            : undefined;
        const requeued = await requeueErrorMetricsForRetry(
            maxRetries,
            limit,
            ruleSetVersion
        );

        fireAndForgetAudit({
            action: "retry_errored_process_metrics",
            req: req as AuthRequest,
            ruleSetVersion: ruleSetVersion ?? null,
            payload: { maxRetries, limit, requeued },
        });

        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Errored process metrics requeued",
            maxRetries,
            limit,
            ruleSetVersion: ruleSetVersion ?? "ALL",
            requeued,
        });
    } catch (error) {
        console.error("Error retrying errored process metrics:", error);
        return res
            .status(500)
            .json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "Error retrying errored process metrics",
            });
    }
};

// GET /api/process/metrics/rule-sets
// Lista rule sets para operación/gobernanza.
export const getRuleSets = async (req: Request, res: Response) => {
    try {
        const activeRuleSetVersion = await getActiveRuleSetVersion();
        const items = await listRuleSets();
        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            activeRuleSetVersion,
            items,
        });
    } catch (error) {
        console.error("Error listing rule sets:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error listing rule sets",
        });
    }
};

// POST /api/process/metrics/rule-sets
// Crea/actualiza definición de rule set sin activarlo.
export const upsertRuleSet = async (req: Request, res: Response) => {
    try {
        const body = req.body as {
            version?: string;
            description?: string;
            metadata?: Record<string, unknown>;
        };
        const version = String(body?.version ?? "").trim();
        if (!version) {
            return res.status(400).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "version is required",
            });
        }

        const item = await upsertRuleSetVersion(
            version,
            String(body?.description ?? ""),
            body?.metadata ?? {}
        );

        fireAndForgetAudit({
            action: "upsert_rule_set",
            req: req as AuthRequest,
            ruleSetVersion: version,
            payload: {
                description: String(body?.description ?? ""),
            },
        });

        return res.status(201).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            item,
        });
    } catch (error) {
        console.error("Error upserting rule set:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error upserting rule set",
        });
    }
};

// POST /api/process/metrics/rule-sets/:version/activate
export const activateRuleSet = async (req: Request, res: Response) => {
    try {
        const version = String(req.params.version ?? "").trim();
        if (!version) {
            return res.status(400).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "version is required",
            });
        }

        const activated = await activateRuleSetVersion(version);
        fireAndForgetAudit({
            action: "activate_rule_set",
            req: req as AuthRequest,
            ruleSetVersion: activated?.version ?? version,
        });
        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Rule set activated",
            activeRuleSetVersion: activated?.version ?? version,
        });
    } catch (error) {
        console.error("Error activating rule set:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error activating rule set",
        });
    }
};

// POST /api/process/metrics/rule-sets/:version/deactivate
export const deactivateRuleSet = async (req: Request, res: Response) => {
    try {
        const version = String(req.params.version ?? "").trim();
        if (!version) {
            return res.status(400).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message: "version is required",
            });
        }

        await deactivateRuleSetVersion(version);
        const activeRuleSetVersion = await getActiveRuleSetVersion();
        fireAndForgetAudit({
            action: "deactivate_rule_set",
            req: req as AuthRequest,
            ruleSetVersion: version,
            payload: { activeAfter: activeRuleSetVersion },
        });
        return res.json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Rule set deactivated",
            activeRuleSetVersion,
        });
    } catch (error) {
        console.error("Error deactivating rule set:", error);
        return res.status(500).json({
            contractVersion: METRICS_API_CONTRACT_VERSION,
            message: "Error deactivating rule set",
        });
    }
};
