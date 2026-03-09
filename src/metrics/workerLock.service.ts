import os from "os";
import MetricsWorkerLock from "../models/metricsWorkerLock.model";

const WORKER_LOCK_NAME = "process-metrics-worker";

export const acquireMetricsWorkerLock = async (
    ttlMs = 120_000
): Promise<boolean> => {
    const now = new Date();
    const lockUntil = new Date(now.getTime() + ttlMs);
    const owner = `${os.hostname()}-${process.pid}`;

    const lock = await MetricsWorkerLock.findOneAndUpdate(
        {
            name: WORKER_LOCK_NAME,
            $or: [
                { lockedUntil: { $lte: now } },
                { lockedUntil: { $exists: false } },
            ],
        },
        {
            $set: {
                lockedUntil: lockUntil,
                owner,
            },
            $setOnInsert: {
                name: WORKER_LOCK_NAME,
            },
        },
        {
            new: true,
            upsert: true,
        }
    ).lean();

    return Boolean(lock && lock.owner === owner);
};

// Libera lock vigente de forma best-effort.
export const releaseMetricsWorkerLock = async (): Promise<void> => {
    await MetricsWorkerLock.updateOne(
        { name: WORKER_LOCK_NAME },
        { $set: { lockedUntil: new Date(0), owner: "" } }
    );
};
