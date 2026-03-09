import { Schema, model } from "mongoose";
import { KPI_RULE_SET_VERSION_V1 } from "../metrics/kpi.contract";

const SlaRuleSetSchema = new Schema(
    {
        version: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        active: {
            type: Boolean,
            default: false,
            index: true,
        },
        description: {
            type: String,
            default: "",
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

export const SlaRuleSet = model("SlaRuleSet", SlaRuleSetSchema);
export default SlaRuleSet;
