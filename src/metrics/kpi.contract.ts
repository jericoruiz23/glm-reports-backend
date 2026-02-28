// Contrato de alcance de KPIs congelado para la primera versión.
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

// Versión inicial de reglas para trazabilidad de cambios de negocio.
export const KPI_RULE_SET_VERSION_V1 = "2026.02.v1";

// Resultado estándar final del contrato de KPI.
export type KpiResult = "success" | "fail" | "pending" | "na";

// Estructura unificada por KPI.
export interface UnifiedKpiMetric {
    result: KpiResult;
    slaTarget: number | null;
    actualValue: number | null;
    delta: number | null;
    meta: Record<string, unknown>;
}

// Códigos oficiales de KPI dentro del rule set activo.
export type KpiCode = (typeof KPI_SCOPE_V1)[number];

// Estructura persistida de cada KPI en process_metrics.
export interface MaterializedKpiItem extends UnifiedKpiMetric {
    code: string;
}

// Convierte mapa de KPIs por código a arreglo materializable.
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

// Convierte arreglo materializado a mapa por código para compatibilidad API.
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

// Convierte el estado de atraso al estándar final del contrato.
export const resolverResultadoDesdeAtraso = (
    atrasado: boolean | null | undefined
): KpiResult => {
    if (atrasado === null || atrasado === undefined) return "pending";
    return atrasado ? "fail" : "success";
};

// Convierte estado legado de demorraje al estándar final del contrato.
export const resolverResultadoDesdeEstadoDemorraje = (
    estado: "CUMPLE" | "NO_CUMPLE" | null | undefined
): KpiResult => {
    if (estado === "CUMPLE") return "success";
    if (estado === "NO_CUMPLE") return "fail";
    return "pending";
};
