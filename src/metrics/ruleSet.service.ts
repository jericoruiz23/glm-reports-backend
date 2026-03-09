import { KPI_RULE_SET_VERSION_V1 } from "./kpi.contract";
import SlaRuleSet from "../models/slaRuleSet.model";

let activeRuleSetCache = KPI_RULE_SET_VERSION_V1;
let activeRuleSetLastFetch = 0;
const CACHE_TTL_MS = 60 * 1000;

export const getActiveRuleSetVersion = async (): Promise<string> => {
    const now = Date.now();
    if (now - activeRuleSetLastFetch < CACHE_TTL_MS) {
        return activeRuleSetCache;
    }

    await SlaRuleSet.findOneAndUpdate(
        { version: KPI_RULE_SET_VERSION_V1 },
        {
            $setOnInsert: {
                version: KPI_RULE_SET_VERSION_V1,
                active: true,
                description: "Default bootstrap rule set",
                metadata: {},
            },
        },
        { upsert: true, new: true }
    );
    const active = await SlaRuleSet.findOne({ active: true })
        .sort({ updatedAt: -1 })
        .lean();

    activeRuleSetCache = active?.version ?? KPI_RULE_SET_VERSION_V1;
    activeRuleSetLastFetch = now;
    return activeRuleSetCache;
};

export const activateRuleSetVersion = async (version: string) => {
    await SlaRuleSet.findOneAndUpdate(
        { version },
        {
            $setOnInsert: {
                version,
                description: "",
                metadata: {},
            },
        },
        { upsert: true }
    );

    await SlaRuleSet.updateMany({ active: true }, { $set: { active: false } });
    const activated = await SlaRuleSet.findOneAndUpdate(
        { version },
        { $set: { active: true } },
        { new: true }
    ).lean();

    activeRuleSetCache = activated?.version ?? KPI_RULE_SET_VERSION_V1;
    activeRuleSetLastFetch = Date.now();
    return activated;
};

export const deactivateRuleSetVersion = async (version: string) => {
    await SlaRuleSet.updateOne({ version }, { $set: { active: false } });
    const remainingActive = await SlaRuleSet.findOne({ active: true }).lean();

    if (!remainingActive) {
        await activateRuleSetVersion(KPI_RULE_SET_VERSION_V1);
    } else {
        activeRuleSetCache = remainingActive.version;
        activeRuleSetLastFetch = Date.now();
    }
};

export const upsertRuleSetVersion = async (
    version: string,
    description = "",
    metadata: Record<string, unknown> = {}
) => {
    return SlaRuleSet.findOneAndUpdate(
        { version },
        {
            $set: {
                description,
                metadata,
            },
            $setOnInsert: {
                version,
                active: false,
            },
        },
        { new: true, upsert: true }
    ).lean();
};

export const listRuleSets = async () => {
    return SlaRuleSet.find().sort({ updatedAt: -1 }).lean();
};
