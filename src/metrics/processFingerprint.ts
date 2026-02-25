import crypto from "crypto";
import { ProcessSlaInput } from "./processMetrics.types";

// Estructura mínima de campos que impactan reglas SLA/KPI.
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

// Normaliza fechas para evitar hashes distintos por formato.
const normalizeDate = (value: unknown): string | null => {
    if (!value) return null;
    const d = new Date(value as any);
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
};

// Construye la vista estable de campos que disparan recálculo.
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

// Retorna hash SHA-256 estable para detectar cambios relevantes.
export const buildProcessFingerprint = (processDoc: ProcessSlaInput): string => {
    const payload = buildFingerprintPayload(processDoc);
    const raw = JSON.stringify(payload);

    return crypto.createHash("sha256").update(raw).digest("hex");
};
