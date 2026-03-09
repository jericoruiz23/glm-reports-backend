import crypto from "crypto";
import { ProcessSlaInput } from "./processMetrics.types";

type FingerprintShape = {
    inicio: {
        regimen: unknown;
        prioridad: unknown;
    };
    postembarque: {
        tipoTransporte: unknown;
        fechaRealLlegadaPuerto: unknown;
    };
    aduana: {
        tipoAforo: unknown;
        fechaEnvioElectronico: unknown;
        fechaSalidaAutorizada: unknown;
    };
    despacho: {
        tipoContenedor: unknown;
        fechaRealEntregaBodega: unknown;
        demorraje: unknown;
    };
};

const normalizeDate = (value: unknown): string | null => {
    if (!value) return null;
    const d = new Date(value as any);
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
};

const buildFingerprintPayload = (processDoc: ProcessSlaInput): FingerprintShape => {
    return {
        inicio: {
            regimen: processDoc?.inicio?.regimen ?? null,
            prioridad: processDoc?.inicio?.prioridad ?? null,
        },
        postembarque: {
            tipoTransporte: processDoc?.postembarque?.tipoTransporte ?? null,
            fechaRealLlegadaPuerto: normalizeDate(
                processDoc?.postembarque?.fechaRealLlegadaPuerto
            ),
        },
        aduana: {
            tipoAforo: processDoc?.aduana?.tipoAforo ?? null,
            fechaEnvioElectronico: normalizeDate(
                processDoc?.aduana?.fechaEnvioElectronico
            ),
            fechaSalidaAutorizada: normalizeDate(
                processDoc?.aduana?.fechaSalidaAutorizada
            ),
        },
        despacho: {
            tipoContenedor: processDoc?.despacho?.tipoContenedor ?? null,
            fechaRealEntregaBodega: normalizeDate(
                processDoc?.despacho?.fechaRealEntregaBodega
            ),
            demorraje:
                typeof processDoc?.despacho?.demorraje === "number"
                    ? processDoc.despacho.demorraje
                    : processDoc?.despacho?.demorraje ?? null,
        },
    };
};

export const buildProcessFingerprint = (processDoc: ProcessSlaInput): string => {
    const payload = buildFingerprintPayload(processDoc);
    const raw = JSON.stringify(payload);

    return crypto.createHash("sha256").update(raw).digest("hex");
};
