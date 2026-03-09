import { Types } from "mongoose";
import MetricsAudit from "../models/metricsAudit.model";
import { AuthRequest } from "../middlewares/auth.middleware";

type AuditPayload = {
    action: string;
    req: AuthRequest;
    processId?: string | null;
    ruleSetVersion?: string | null;
    payload?: Record<string, unknown>;
};

export const auditMetricsAction = async ({
    action,
    req,
    processId,
    ruleSetVersion,
    payload,
}: AuditPayload) => {
    try {
        const user = req.user;
        const actorUserId =
            user?.id && Types.ObjectId.isValid(user.id)
                ? new Types.ObjectId(user.id)
                : undefined;
        const normalizedProcessId =
            processId && Types.ObjectId.isValid(processId)
                ? new Types.ObjectId(processId)
                : undefined;

        await MetricsAudit.create({
            action,
            actorUserId,
            actorRole: user?.role ?? null,
            processId: normalizedProcessId,
            ruleSetVersion: ruleSetVersion ?? null,
            payload: payload ?? {},
        });
    } catch (error) {

        console.error("metrics audit write failed:", error);
    }
};

export const getLegacyUsageStats = async (days = 7) => {
    const safeDays =
        Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
    const from = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const [total, byDay] = await Promise.all([
        MetricsAudit.countDocuments({
            action: "process_list_legacy_true",
            createdAt: { $gte: from },
        }),
        MetricsAudit.aggregate([
            {
                $match: {
                    action: "process_list_legacy_true",
                    createdAt: { $gte: from },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
    ]);

    return {
        windowDays: safeDays,
        total,
        byDay,
    };
};
