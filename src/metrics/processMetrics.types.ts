import { Types } from "mongoose";

// Subconjunto de datos de Process necesarios para cálculo/fingerprint.
export interface ProcessSlaInput {
    _id: Types.ObjectId | string;
    updatedAt?: Date | string;
    proceso?: string;
    inicio?: {
        regimen?: string | null;
        prioridad?: string | null;
    } | null;
    postembarque?: {
        tipoTransporte?: string | null;
        fechaRealLlegadaPuerto?: Date | string | null;
    } | null;
    aduana?: {
        tipoAforo?: string | null;
        fechaEnvioElectronico?: Date | string | null;
        fechaSalidaAutorizada?: Date | string | null;
    } | null;
    despacho?: {
        tipoContenedor?: string | null;
        fechaRealEntregaBodega?: Date | string | null;
        demorraje?: number | null;
    } | null;
    automatico?: {
        cumplimientoDemorraje?: {
            estandar?: number | null;
            valorReal?: number | null;
            cumple?: boolean | null;
            estado?: "CUMPLE" | "NO_CUMPLE" | null;
            diferencia?: number | null;
        } | null;
    } | null;
}

// Documento mínimo esperado en process_metrics para el worker.
export interface ProcessMetricsQueueDoc {
    _id: Types.ObjectId | string;
    processId: Types.ObjectId | string;
    processFingerprint: string;
    status: "stale" | "calculating" | "fresh" | "error";
    ruleSetVersion: string;
    updatedAt?: Date | string;
}
