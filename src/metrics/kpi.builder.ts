import {
    KPI_RULE_SET_VERSION_V1,
    KPI_SCOPE_V1,
    UnifiedKpiMetric,
    resolverResultadoDesdeAtraso,
    resolverResultadoDesdeEstadoDemorraje,
} from "./kpi.contract";
import { evaluarDemorraje, evaluarEntregaBodega, evaluarEtaEnvioElectronico, evaluarEtaSalidaAutorizada } from "../utils/sla.service";
import { evaluarEnvioElectronicoSalida } from "../utils/slaMatrix";
import { DEMORRAJE_ESTANDAR_FALLBACK } from "../utils/demorraje.constants";

// Construye el contrato legado de demorraje cuando aún no existe el materializado.
const construirContratoDemorrajeFallback = (process: any) => {
    const estandar = DEMORRAJE_ESTANDAR_FALLBACK;
    const estado = evaluarDemorraje(process, estandar);
    const valorFuente = process?.despacho?.demorraje;
    const valorReal =
        typeof valorFuente === "number" && Number.isFinite(valorFuente)
            ? valorFuente
            : null;

    if (valorReal === null) {
        return {
            estandar,
            valorReal: null,
            cumple: null,
            estado: null,
            diferencia: null,
        };
    }

    return {
        estandar,
        valorReal,
        cumple: estado === "CUMPLE",
        estado,
        diferencia: valorReal - estandar,
    };
};

// Normaliza KPIs con patrón SLA (eta envio, eta salida, entrega bodega).
const construirKpiSla = (
    metric: any,
    kpiCode: string
): UnifiedKpiMetric => {
    // Si la regla no aplica o no existe dato suficiente, se marca como "na".
    if (!metric) {
        return {
            result: "na",
            slaTarget: null,
            actualValue: null,
            delta: null,
            meta: {
                kpiCode,
                source: "LIVE_FALLBACK",
                stale: true,
                reason: "NO_RULE_OR_INSUFFICIENT_DATA",
            },
        };
    }

    const actualValue =
        typeof metric?.diasReales === "number" ? metric.diasReales : null;
    const slaTarget =
        typeof metric?.sla === "number" ? metric.sla : null;
    const delta =
        typeof metric?.diferencia === "number" ? metric.diferencia : null;

    return {
        result:
            actualValue === null
                ? "pending"
                : resolverResultadoDesdeAtraso(metric?.atrasado),
        slaTarget,
        actualValue,
        delta,
        meta: {
            kpiCode,
            source: "LIVE_FALLBACK",
            stale: true,
            tipoRegla: metric?.tipoRegla ?? null,
            atrasado: metric?.atrasado ?? null,
            fechaObjetivo: metric?.fechaObjetivo ?? null,
        },
    };
};

// Construye todos los datos de métricas de tránsito para un proceso.
// Nota: en Fase 0/1 se mantiene compatibilidad con campos legacy.
export const construirMetricasTransito = (process: any) => {
    const etaEnvioElectronico = evaluarEtaEnvioElectronico(process);
    const envioElectronicoSalidaAutorizada = evaluarEnvioElectronicoSalida(process);
    const etaSalidaAutorizada = evaluarEtaSalidaAutorizada(process);
    const entregaEnBodega = evaluarEntregaBodega(process);

    const demorrajeContrato =
        process?.automatico?.cumplimientoDemorraje ??
        construirContratoDemorrajeFallback(process);

    const estandarDemorraje =
        typeof demorrajeContrato?.estandar === "number"
            ? demorrajeContrato.estandar
            : DEMORRAJE_ESTANDAR_FALLBACK;

    const demorraje = evaluarDemorraje(process, estandarDemorraje);

    return {
        // Campos legacy (compatibilidad actual con frontend/consumidores).
        demorraje,
        demorrajeContrato,
        etaEnvioElectronico,
        envioElectronicoSalidaAutorizada,
        etaSalidaAutorizada,
        entregaEnBodega,
        // Contrato unificado de KPIs.
        ruleSetVersion: KPI_RULE_SET_VERSION_V1,
        kpiScope: KPI_SCOPE_V1,
        kpis: {
            ETA_ENVIO: construirKpiSla(etaEnvioElectronico, "ETA_ENVIO"),
            ETA_SALIDA: construirKpiSla(etaSalidaAutorizada, "ETA_SALIDA"),
            ENTREGA_BODEGA: construirKpiSla(entregaEnBodega, "ENTREGA_BODEGA"),
            DEMORRAJE: {
                result: resolverResultadoDesdeEstadoDemorraje(demorrajeContrato?.estado),
                slaTarget:
                    typeof demorrajeContrato?.estandar === "number"
                        ? demorrajeContrato.estandar
                        : null,
                actualValue:
                    typeof demorrajeContrato?.valorReal === "number"
                        ? demorrajeContrato.valorReal
                        : null,
                delta:
                    typeof demorrajeContrato?.diferencia === "number"
                        ? demorrajeContrato.diferencia
                        : null,
                meta: {
                    kpiCode: "DEMORRAJE",
                    // Si viene de automatico se considera materializado; si no, fallback en vivo.
                    source: process?.automatico?.cumplimientoDemorraje
                        ? "MATERIALIZED_COMPAT"
                        : "LIVE_FALLBACK",
                    stale: !process?.automatico?.cumplimientoDemorraje,
                    cumple: demorrajeContrato?.cumple ?? null,
                    legacyEstado: demorrajeContrato?.estado ?? null,
                },
            } as UnifiedKpiMetric,
        },
    };
};
