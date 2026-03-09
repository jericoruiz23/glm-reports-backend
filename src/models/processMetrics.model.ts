import { Schema, model, Types } from "mongoose";
import { KPI_RULE_SET_VERSION_V1, MaterializedKpiItem } from "../metrics/kpi.contract";

export type ProcessMetricsStatus =
    | "stale"
    | "calculating"
    | "fresh"
    | "error";

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

ProcessMetricsSchema.index(
    { processId: 1, ruleSetVersion: 1 },
    { unique: true }
);

ProcessMetricsSchema.index({ status: 1, updatedAt: -1 });

export const ProcessMetrics = model("ProcessMetrics", ProcessMetricsSchema);

export default ProcessMetrics;
