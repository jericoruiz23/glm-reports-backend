import { KPI_RULE_SET_VERSION_V1 } from "./kpi.contract";
import { construirMetricasTransito } from "./kpi.builder";
import { kpisMapToArray, MaterializedKpiItem, UnifiedKpiMetric } from "./kpi.contract";

// Resultado puro del cómputo de métricas materializadas.
export interface ComputedProcessMetrics {
    ruleSetVersion: string;
    kpis: MaterializedKpiItem[];
    summary: {
        total: number;
        success: number;
        fail: number;
        pending: number;
        na: number;
        // score global basado en KPIs evaluables (success/fail).
        score: number | null;
    };
}

// Función pura: construye kpis + summary sin escribir en DB.
export const computeProcessMetrics = (
    processDoc: any,
    ruleSetVersion = KPI_RULE_SET_VERSION_V1
): ComputedProcessMetrics => {
    const metricasTransito = construirMetricasTransito(processDoc);
    const kpisMap: Record<string, UnifiedKpiMetric> = metricasTransito?.kpis ?? {};

    // Normaliza el objeto de KPIs en array persistible.
    const kpis = kpisMapToArray(kpisMap);

    // Resume resultados para facilitar consumo de dashboards/listados.
    const summary = kpis.reduce(
        (acc, kpi) => {
            acc.total += 1;
            if (kpi.result === "success") acc.success += 1;
            if (kpi.result === "fail") acc.fail += 1;
            if (kpi.result === "pending") acc.pending += 1;
            if (kpi.result === "na") acc.na += 1;
            return acc;
        },
        {
            total: 0,
            success: 0,
            fail: 0,
            pending: 0,
            na: 0,
        }
    );

    // Score global solo sobre KPIs con outcome evaluable.
    const evaluables = summary.success + summary.fail;
    const score =
        evaluables > 0
            ? Number(((summary.success / evaluables) * 100).toFixed(2))
            : null;

    return {
        ruleSetVersion,
        kpis,
        summary: {
            ...summary,
            score,
        },
    };
};
