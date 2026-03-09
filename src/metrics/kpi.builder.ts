import {
    KPI_RULE_SET_VERSION_V1,
    KPI_SCOPE_V1,
    UnifiedKpiMetric,
    resolverResultadoDesdeAtraso,
    resolverResultadoDesdeEstadoDemorraje,
} from "./kpi.contract";
import { evaluarDemorraje, evaluarEntregaBodega, evaluarEtaEnvioElectronico, evaluarEtaSalidaAutorizada } from "../utils/sla.service";
import { evaluarEnvioElectronicoSalida, resolverSLASalidaAutorizada } from "../utils/slaMatrix";
import { DEMORRAJE_ESTANDAR_FALLBACK } from "../utils/demorraje.constants";
import { calcularDiasLaborables } from "../utils/dateUtils";

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

const construirKpiSla = (
    metric: any,
    kpiCode: string,
    metaExtras: Record<string, unknown> = {}
): UnifiedKpiMetric => {

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
                ...metaExtras,
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
            ...metaExtras,
        },
    };
};

const normalizarTexto = (valor: unknown): string => {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
};

const esPrioridadAlta = (prioridad: unknown): boolean => {
    const valor = normalizarTexto(prioridad);
    return valor === "PRIORIDAD" || valor === "CRITICO";
};

const esAforoAutomatico = (tipoAforo: unknown): boolean => {
    return normalizarTexto(tipoAforo).includes("AUTOMATICO");
};

const construirProcesoEscenarioSalida = (
    process: any,
    prioridad: "NORMAL" | "PRIORIDAD"
) => {
    return {
        ...process,
        inicio: {
            ...(process?.inicio ?? {}),
            prioridad,
        },
        aduana: {
            ...(process?.aduana ?? {}),
            tipoAforo: "AUTOMATICO",
        },
    };
};

const construirKpiEscenarioSalida = (
    process: any,
    kpiCode: string,
    prioridad: "NORMAL" | "PRIORIDAD",
    actualMetric: any,
    label: string
): UnifiedKpiMetric => {
    const scenarioProcess = construirProcesoEscenarioSalida(process, prioridad);
    const slaTarget = resolverSLASalidaAutorizada(scenarioProcess);
    const matchesPriority = prioridad === "PRIORIDAD"
        ? esPrioridadAlta(process?.inicio?.prioridad)
        : normalizarTexto(process?.inicio?.prioridad) === "NORMAL";
    const appliesToCurrentProcess = matchesPriority && esAforoAutomatico(process?.aduana?.tipoAforo);

    if (typeof slaTarget !== "number") {
        return {
            result: "na",
            slaTarget: null,
            actualValue: null,
            delta: null,
            meta: {
                kpiCode,
                label,
                source: "SLA_SALIDA_MATRIX",
                stale: true,
                appliesToCurrentProcess,
                scenarioPriority: prioridad,
                scenarioAforo: "AUTOMATICO",
                reason: "NO_RULE_FOR_SCENARIO",
            },
        };
    }

    if (!appliesToCurrentProcess) {
        return {
            result: "na",
            slaTarget,
            actualValue: null,
            delta: null,
            meta: {
                kpiCode,
                label,
                source: "SLA_SALIDA_MATRIX",
                stale: true,
                appliesToCurrentProcess: false,
                scenarioPriority: prioridad,
                scenarioAforo: "AUTOMATICO",
            },
        };
    }

    const actualValue =
        typeof actualMetric?.diasReales === "number" ? actualMetric.diasReales : null;
    const delta =
        actualValue === null ? null : Math.max(actualValue - slaTarget, 0);

    return {
        result:
            actualValue === null
                ? "pending"
                : actualValue > slaTarget
                    ? "fail"
                    : "success",
        slaTarget,
        actualValue,
        delta,
        meta: {
            kpiCode,
            label,
            source: "SLA_SALIDA_MATRIX",
            stale: true,
            appliesToCurrentProcess: true,
            scenarioPriority: prioridad,
            scenarioAforo: "AUTOMATICO",
        },
    };
};

const calcularDiasHabilesEntreFechas = (
    fechaInicio: unknown,
    fechaFin: unknown
): number | null => {
    if (!fechaInicio || !fechaFin) return null;

    const inicio = new Date(fechaInicio as string | number | Date);
    const fin = new Date(fechaFin as string | number | Date);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
        return null;
    }

    return calcularDiasLaborables(inicio, fin);
};

const construirKpiActualSinSla = (
    kpiCode: string,
    actualValue: number | null,
    label: string,
    metaExtras: Record<string, unknown> = {}
): UnifiedKpiMetric => {
    const hasActual = typeof actualValue === "number";

    return {
        result: hasActual ? "na" : "pending",
        slaTarget: null,
        actualValue: hasActual ? actualValue : null,
        delta: null,
        meta: {
            kpiCode,
            label,
            source: "DERIVED_ACTUAL",
            stale: true,
            ...metaExtras,
        },
    };
};

const construirKpiGlobalPercent = (
    kpis: Record<string, UnifiedKpiMetric>
): UnifiedKpiMetric => {
    const evaluables = Object.entries(kpis).filter(([, kpi]) => {
        return kpi.result === "success" || kpi.result === "fail";
    });
    const successCount = evaluables.filter(([, kpi]) => kpi.result === "success").length;
    const actualValue =
        evaluables.length > 0
            ? Number(((successCount / evaluables.length) * 100).toFixed(2))
            : null;

    return {
        result: "na",
        slaTarget: 100,
        actualValue,
        delta:
            actualValue === null ? null : Number((100 - actualValue).toFixed(2)),
        meta: {
            kpiCode: "ESTANDAR_GLOBAL_TOTAL_PCT",
            label: "ESTANDAR GLOBAL TOTAL %",
            source: "DERIVED_FROM_KPIS",
            stale: true,
            scope: "global",
            basedOnEvaluableKpis: evaluables.length,
        },
    };
};

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
    const etaHastaDespacho = calcularDiasHabilesEntreFechas(
        process?.postembarque?.fechaRealLlegadaPuerto,
        process?.despacho?.fechaRealDespachoPuerto
    );
    const etaHastaEntregaBodega = calcularDiasHabilesEntreFechas(
        process?.postembarque?.fechaRealLlegadaPuerto,
        process?.despacho?.fechaRealEntregaBodega
    );
    const entregaBodegaHastaCarpetas = calcularDiasHabilesEntreFechas(
        process?.despacho?.fechaRealEntregaBodega,
        process?.despacho?.fechaFacturacionCostos
    );
    const kpis: Record<string, UnifiedKpiMetric> = {
        ETA_ENVIO: construirKpiSla(etaEnvioElectronico, "ETA_ENVIO"),
        ENVIO_SALIDA_AUTORIZADA: construirKpiSla(
            envioElectronicoSalidaAutorizada,
            "ENVIO_SALIDA_AUTORIZADA",
            {
                label: "DIAS HABILES DESDE ENVIO ELECTRONICO HASTA SALIDA AUTORIZADA",
                source: "SLA_SALIDA_MATRIX",
            }
        ),
        ETA_SALIDA: construirKpiSla(etaSalidaAutorizada, "ETA_SALIDA"),
        ENTREGA_BODEGA: construirKpiSla(entregaEnBodega, "ENTREGA_BODEGA"),
        GESTION_BODEGAS_TRANSPORTE_NORMAL_AUTO: construirKpiEscenarioSalida(
            process,
            "GESTION_BODEGAS_TRANSPORTE_NORMAL_AUTO",
            "NORMAL",
            envioElectronicoSalidaAutorizada,
            "GESTION BODEGAS Y COMPANIAS DE TRANSPORTE NORMAL AFORO AUTOMATICO"
        ),
        GESTION_BODEGAS_TRANSPORTE_PRIORIDAD_AUTO: construirKpiEscenarioSalida(
            process,
            "GESTION_BODEGAS_TRANSPORTE_PRIORIDAD_AUTO",
            "PRIORIDAD",
            envioElectronicoSalidaAutorizada,
            "GESTION BODEGAS Y COMPANIAS DE TRANSPORTE PRIORIDAD AFORO AUTOMATICO"
        ),
        DIA_PARA_DESPACHO: construirKpiSla(
            entregaEnBodega,
            "DIA_PARA_DESPACHO",
            {
                label: "DIA PARA DESPACHO NORMAL / PRIORIDAD",
                source: "SLA_ENTREGA_BODEGA_MATRIX",
                duplicatedFrom: "ENTREGA_BODEGA",
            }
        ),
        ETA_DESPACHO_TOTAL: construirKpiActualSinSla(
            "ETA_DESPACHO_TOTAL",
            etaHastaDespacho,
            "TOTAL DIAS HABILES DESDE ETA HASTA DESPACHO",
            {
                dateStartField: "postembarque.fechaRealLlegadaPuerto",
                dateEndField: "despacho.fechaRealDespachoPuerto",
            }
        ),
        ETA_ENTREGA_BODEGA_TOTAL: construirKpiActualSinSla(
            "ETA_ENTREGA_BODEGA_TOTAL",
            etaHastaEntregaBodega,
            "TOTAL DIAS HABILES DESDE ETA HASTA ENTREGA EN BODEGA",
            {
                dateStartField: "postembarque.fechaRealLlegadaPuerto",
                dateEndField: "despacho.fechaRealEntregaBodega",
            }
        ),
        ENTREGA_BODEGA_CARPETAS: construirKpiActualSinSla(
            "ENTREGA_BODEGA_CARPETAS",
            entregaBodegaHastaCarpetas,
            "DIAS HABILES DESDE FECHA DE ENTREGA EN BODEGA HASTA FECHA DE ENTREGA DE CARPETAS",
            {
                dateStartField: "despacho.fechaRealEntregaBodega",
                dateEndField: "despacho.fechaFacturacionCostos",
            }
        ),
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

                source: process?.automatico?.cumplimientoDemorraje
                    ? "MATERIALIZED_COMPAT"
                    : "LIVE_FALLBACK",
                stale: !process?.automatico?.cumplimientoDemorraje,
                cumple: demorrajeContrato?.cumple ?? null,
                legacyEstado: demorrajeContrato?.estado ?? null,
            },
        } as UnifiedKpiMetric,
    };
    kpis.ESTANDAR_GLOBAL_TOTAL_PCT = construirKpiGlobalPercent(kpis);

    return {

        demorraje,
        demorrajeContrato,
        etaEnvioElectronico,
        envioElectronicoSalidaAutorizada,
        etaSalidaAutorizada,
        entregaEnBodega,

        ruleSetVersion: KPI_RULE_SET_VERSION_V1,
        kpiScope: KPI_SCOPE_V1,
        kpis,
    };
};
