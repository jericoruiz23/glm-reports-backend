
export const KPI_SCOPE_V1 = [
    "ETA_ENVIO",
    "ENVIO_SALIDA_AUTORIZADA",
    "ETA_SALIDA",
    "ENTREGA_BODEGA",
    "GESTION_BODEGAS_TRANSPORTE_NORMAL_AUTO",
    "GESTION_BODEGAS_TRANSPORTE_PRIORIDAD_AUTO",
    "DIA_PARA_DESPACHO",
    "ETA_DESPACHO_TOTAL",
    "ETA_ENTREGA_BODEGA_TOTAL",
    "ENTREGA_BODEGA_CARPETAS",
    "DEMORRAJE",
    "ESTANDAR_GLOBAL_TOTAL_PCT",
] as const;

export const KPI_RULE_SET_VERSION_V1 = "2026.02.v1";

export type KpiResult = "success" | "fail" | "pending" | "na";

export interface UnifiedKpiMetric {
    result: KpiResult;
    slaTarget: number | null;
    actualValue: number | null;
    delta: number | null;
    meta: Record<string, unknown>;
}

export type KpiCode = (typeof KPI_SCOPE_V1)[number];

export interface MaterializedKpiItem extends UnifiedKpiMetric {
    code: string;
}

export const kpisMapToArray = (
    kpis: Record<string, UnifiedKpiMetric>
): MaterializedKpiItem[] => {
    return Object.entries(kpis).map(([code, value]) => ({
        code,
        result: value.result,
        slaTarget: value.slaTarget,
        actualValue: value.actualValue,
        delta: value.delta,
        meta: value.meta,
    }));
};

export const kpisArrayToMap = (
    kpis: MaterializedKpiItem[] | null | undefined
): Record<string, UnifiedKpiMetric> => {
    const map: Record<string, UnifiedKpiMetric> = {};
    for (const item of kpis ?? []) {
        if (!item?.code) continue;
        map[item.code] = {
            result: item.result ?? "pending",
            slaTarget: typeof item.slaTarget === "number" ? item.slaTarget : null,
            actualValue:
                typeof item.actualValue === "number" ? item.actualValue : null,
            delta: typeof item.delta === "number" ? item.delta : null,
            meta: item.meta && typeof item.meta === "object" ? item.meta : {},
        };
    }
    return map;
};

export const resolverResultadoDesdeAtraso = (
    atrasado: boolean | null | undefined
): KpiResult => {
    if (atrasado === null || atrasado === undefined) return "pending";
    return atrasado ? "fail" : "success";
};

export const resolverResultadoDesdeEstadoDemorraje = (
    estado: "CUMPLE" | "NO_CUMPLE" | null | undefined
): KpiResult => {
    if (estado === "CUMPLE") return "success";
    if (estado === "NO_CUMPLE") return "fail";
    return "pending";
};
