import { describe, expect, it } from "vitest";
import {
    resolverSLAEntregaBodega,
    resolverSLAEtaEnvio,
    resolverSLAEtaSalidaAutorizada,
    resolverSLASalidaAutorizada,
} from "../../src/utils/slaMatrix";

const buildProcess = (prioridad: "NORMAL" | "PRIORIDAD" | "CRITICO", via: string) => ({
    inicio: { regimen: "10", prioridad },
    postembarque: { tipoTransporte: via },
    despacho: { tipoContenedor: "CARGA SUELTA" },
    aduana: { tipoAforo: "FISICO" },
});

describe("slaMatrix prioridad", () => {
    it("uses the same SLA for CRITICO and PRIORIDAD in KPI resolvers", () => {
        const prioridadEtaEnvio = buildProcess("PRIORIDAD", "AEREO COURIER - CONSUMO");
        const criticoEtaEnvio = buildProcess("CRITICO", "AEREO COURIER - CONSUMO");
        expect(resolverSLAEtaEnvio(criticoEtaEnvio as any)).toBe(
            resolverSLAEtaEnvio(prioridadEtaEnvio as any)
        );

        const prioridadBase = buildProcess("PRIORIDAD", "AEREO");
        const criticoBase = buildProcess("CRITICO", "AEREO");
        expect(resolverSLASalidaAutorizada(criticoBase as any)).toBe(
            resolverSLASalidaAutorizada(prioridadBase as any)
        );
        expect(resolverSLAEtaSalidaAutorizada(criticoBase as any)).toBe(
            resolverSLAEtaSalidaAutorizada(prioridadBase as any)
        );
        expect(resolverSLAEntregaBodega(criticoBase as any)).toBe(
            resolverSLAEntregaBodega(prioridadBase as any)
        );
    });

    it("keeps NORMAL behavior distinct where matrix currently differs", () => {
        const normalEtaEnvio = buildProcess("NORMAL", "AEREO COURIER - CONSUMO");
        const prioridadEtaEnvio = buildProcess("PRIORIDAD", "AEREO COURIER - CONSUMO");
        expect(resolverSLAEtaEnvio(normalEtaEnvio as any)).toBe(2);
        expect(resolverSLAEtaEnvio(prioridadEtaEnvio as any)).toBe(1);

        const normalBase = buildProcess("NORMAL", "AEREO");
        const prioridadBase = buildProcess("PRIORIDAD", "AEREO");
        expect(resolverSLASalidaAutorizada(normalBase as any)).toBe(3);
        expect(resolverSLASalidaAutorizada(prioridadBase as any)).toBe(1);
        expect(resolverSLAEtaSalidaAutorizada(normalBase as any)).toBe(3);
        expect(resolverSLAEtaSalidaAutorizada(prioridadBase as any)).toBe(2);
    });
});
