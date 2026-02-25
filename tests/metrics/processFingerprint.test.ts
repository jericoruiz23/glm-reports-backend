import { describe, expect, it } from "vitest";
import { buildProcessFingerprint } from "../../src/metrics/processFingerprint";

describe("buildProcessFingerprint", () => {
    it("returns stable hash for same relevant payload", () => {
        const processDoc = {
            inicio: { regimen: "10", prioridad: "NORMAL" },
            postembarque: {
                tipoTransporte: "MARITIMO",
                fechaRealLlegadaPuerto: "2026-01-10T12:00:00.000Z",
            },
            aduana: {
                tipoAforo: "DOCUMENTAL",
                fechaEnvioElectronico: "2026-01-11T12:00:00.000Z",
                fechaSalidaAutorizada: "2026-01-12T12:00:00.000Z",
            },
            despacho: {
                tipoContenedor: "CONTENEDOR",
                fechaRealEntregaBodega: "2026-01-15T12:00:00.000Z",
                demorraje: 4,
            },
        };

        const a = buildProcessFingerprint(processDoc as any);
        const b = buildProcessFingerprint({ ...processDoc } as any);
        expect(a).toBe(b);
    });

    it("changes hash when relevant field changes", () => {
        const base = {
            inicio: { regimen: "10", prioridad: "NORMAL" },
            postembarque: { tipoTransporte: "MARITIMO" },
            aduana: { tipoAforo: "DOCUMENTAL" },
            despacho: { tipoContenedor: "CONTENEDOR", demorraje: 4 },
        };

        const a = buildProcessFingerprint(base as any);
        const b = buildProcessFingerprint({
            ...base,
            despacho: { ...base.despacho, demorraje: 7 },
        } as any);
        expect(a).not.toBe(b);
    });
});
