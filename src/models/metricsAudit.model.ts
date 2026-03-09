import { Schema, model, Types } from "mongoose";

const MetricsAuditSchema = new Schema(
    {
        action: {
            type: String,
            required: true,
            index: true,
        },
        actorUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: false,
            index: true,
        },
        actorRole: {
            type: String,
            default: null,
        },
        processId: {
            type: Schema.Types.ObjectId,
            ref: "Process",
            required: false,
            index: true,
        },
        ruleSetVersion: {
            type: String,
            default: null,
            index: true,
        },
        payload: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

MetricsAuditSchema.index({ action: 1, createdAt: -1 });

export const MetricsAudit = model("MetricsAudit", MetricsAuditSchema);
export default MetricsAudit;
