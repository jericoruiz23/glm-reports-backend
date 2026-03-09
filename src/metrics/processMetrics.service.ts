import { KPI_RULE_SET_VERSION_V1 } from "./kpi.contract";
import ProcessMetrics from "../models/processMetrics.model";
import { buildProcessFingerprint } from "./processFingerprint";
import { ProcessSlaInput } from "./processMetrics.types";
import { getActiveRuleSetVersion } from "./ruleSet.service";

export const markProcessMetricsStale = async (
    processDoc: ProcessSlaInput
): Promise<string> => {
    if (!processDoc?._id) {
        throw new Error("markProcessMetricsStale requiere processDoc._id");
    }

    const processFingerprint = buildProcessFingerprint(processDoc);
    const processUpdatedAt = processDoc?.updatedAt
        ? new Date(processDoc.updatedAt)
        : new Date();
    const processType =
        typeof processDoc?.proceso === "string" ? processDoc.proceso : "";

    const activeRuleSetVersion =
        (await getActiveRuleSetVersion()) ?? KPI_RULE_SET_VERSION_V1;

    await ProcessMetrics.findOneAndUpdate(
        {
            processId: processDoc._id,
            ruleSetVersion: activeRuleSetVersion,
        },
        {
            $set: {
                status: "stale",
                processUpdatedAt,
                processFingerprint,
                processType,
                ruleSetVersion: activeRuleSetVersion,
                lastError: null,
                retryCount: 0,
            },

            $setOnInsert: {
                kpis: [],
                summary: undefined,
                calculatedAt: null,
            },
        },
        {
            upsert: true,
            new: true,
        }
    );

    return activeRuleSetVersion;
};
