import { Schema, model, Types } from "mongoose";
import { KPI_RULE_SET_VERSION_V1, MaterializedKpiItem } from "../metrics/kpi.contract";

// Estados del ciclo de vida de métricas por proceso.
export type ProcessMetricsStatus =
    | "stale"
    | "calculating"
    | "fresh"
    | "error";

// Documento mínimo de materialización para Fase 1.
export interface IProcessMetrics {
    processId: Types.ObjectId;
    processUpdatedAt: Date | null;
    processFingerprint: string;
    processType: string;
    ruleSetVersion: string;
    status: ProcessMetricsStatus;
    kpis: MaterializedKpiItem[];
    summary?: Record<string, unknown>;
    calculatedAt?: Date | null;
    lastError?: string | null;
    retryCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const ProcessMetricsSchema = new Schema(
    {
        processId: {
            type: Schema.Types.ObjectId,
            ref: "Process",
            required: true,
            index: true,
        },
        processUpdatedAt: {
            type: Date,
            default: null,
        },
        processFingerprint: {
            type: String,
            required: true,
        },
        processType: {
            type: String,
            default: "",
        },
        ruleSetVersion: {
            type: String,
            default: KPI_RULE_SET_VERSION_V1,
            required: true,
        },
        status: {
            type: String,
            enum: ["stale", "calculating", "fresh", "error"],
            default: "stale",
            index: true,
        },
        // En Fase 1 puede quedar vacío; el worker poblará luego.
        kpis: {
            type: Array,
            default: [],
        },
        summary: {
            type: Schema.Types.Mixed,
            default: undefined,
        },
        calculatedAt: {
            type: Date,
            default: null,
        },
        lastError: {
            type: String,
            default: null,
        },
        // Conteo de reintentos controlados cuando cae en estado error.
        retryCount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Un documento por proceso + versión de reglas.
ProcessMetricsSchema.index(
    { processId: 1, ruleSetVersion: 1 },
    { unique: true }
);

// Soporte para colas/listados por estado de cálculo.
ProcessMetricsSchema.index({ status: 1, updatedAt: -1 });

export const ProcessMetrics = model("ProcessMetrics", ProcessMetricsSchema);

export default ProcessMetrics;
