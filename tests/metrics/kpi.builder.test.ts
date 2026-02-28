import { describe, expect, it } from "vitest";
import { construirMetricasTransito } from "../../src/metrics/kpi.builder";
import { calcularDiasLaborables } from "../../src/utils/dateUtils";

describe("construirMetricasTransito", () => {
    it("adds the requested KPI structure using the unified contract", () => {
        const processDoc = {
            inicio: {
                regimen: "10",
                prioridad: "NORMAL",
            },
            postembarque: {
                tipoTransporte: "AEREO",
                fechaRealLlegadaPuerto: "2026-02-02T12:00:00.000Z",
            },
            aduana: {
                tipoAforo: "AUTOMATICO",
                fechaEnvioElectronico: "2026-02-03T12:00:00.000Z",
                fechaSalidaAutorizada: "2026-02-04T12:00:00.000Z",
            },
            despacho: {
                tipoContenedor: "CARGA SUELTA",
                fechaRealDespachoPuerto: "2026-02-05T12:00:00.000Z",
                fechaRealEntregaBodega: "2026-02-06T12:00:00.000Z",
                fechaFacturacionCostos: "2026-02-09T12:00:00.000Z",
                demorraje: 2,
            },
        };

        const out = construirMetricasTransito(processDoc as any);
        const expectedEtaDespacho = calcularDiasLaborables(
            new Date("2026-02-02T12:00:00.000Z"),
            new Date("2026-02-05T12:00:00.000Z")
        );
        const expectedEtaEntregaBodega = calcularDiasLaborables(
            new Date("2026-02-02T12:00:00.000Z"),
            new Date("2026-02-06T12:00:00.000Z")
        );
        const expectedEntregaBodegaCarpetas = calcularDiasLaborables(
            new Date("2026-02-06T12:00:00.000Z"),
            new Date("2026-02-09T12:00:00.000Z")
        );

        expect(out.kpiScope).toEqual(
            expect.arrayContaining([
                "ENVIO_SALIDA_AUTORIZADA",
                "GESTION_BODEGAS_TRANSPORTE_NORMAL_AUTO",
                "GESTION_BODEGAS_TRANSPORTE_PRIORIDAD_AUTO",
                "DIA_PARA_DESPACHO",
                "ETA_DESPACHO_TOTAL",
                "ETA_ENTREGA_BODEGA_TOTAL",
                "ENTREGA_BODEGA_CARPETAS",
                "ESTANDAR_GLOBAL_TOTAL_PCT",
            ])
        );

        expect(out.kpis.ENVIO_SALIDA_AUTORIZADA).toEqual(
            expect.objectContaining({
                result: "fail",
                slaTarget: 0,
                actualValue: 1,
            })
        );
        expect(out.kpis.ENVIO_SALIDA_AUTORIZADA.meta).toEqual(
            expect.objectContaining({
                label: "DIAS HABILES DESDE ENVIO ELECTRONICO HASTA SALIDA AUTORIZADA",
                source: "SLA_SALIDA_MATRIX",
            })
        );

        expect(out.kpis.GESTION_BODEGAS_TRANSPORTE_NORMAL_AUTO).toEqual(
            expect.objectContaining({
                result: "fail",
                slaTarget: 0,
                actualValue: 1,
            })
        );
        expect(out.kpis.GESTION_BODEGAS_TRANSPORTE_PRIORIDAD_AUTO.result).toBe("na");
        expect(out.kpis.ETA_DESPACHO_TOTAL.actualValue).toBe(expectedEtaDespacho);
        expect(out.kpis.ETA_ENTREGA_BODEGA_TOTAL.actualValue).toBe(expectedEtaEntregaBodega);
        expect(out.kpis.ENTREGA_BODEGA_CARPETAS.actualValue).toBe(expectedEntregaBodegaCarpetas);
        expect(out.kpis.ESTANDAR_GLOBAL_TOTAL_PCT).toEqual(
            expect.objectContaining({
                result: "na",
                slaTarget: 100,
                actualValue: expect.any(Number),
            })
        );
        expect(out.kpis.ESTANDAR_GLOBAL_TOTAL_PCT.meta).toEqual(
            expect.objectContaining({
                scope: "global",
                source: "DERIVED_FROM_KPIS",
            })
        );
    });
});
