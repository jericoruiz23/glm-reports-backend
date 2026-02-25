import { Schema, model } from "mongoose";

// Lock distribuido simple para evitar solapamiento de ejecuciones del worker.
const MetricsWorkerLockSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        lockedUntil: {
            type: Date,
            required: true,
            index: true,
        },
        owner: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

export const MetricsWorkerLock = model(
    "MetricsWorkerLock",
    MetricsWorkerLockSchema
);
export default MetricsWorkerLock;
