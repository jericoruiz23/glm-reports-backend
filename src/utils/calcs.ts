// utils/calcs.ts
import { calcularDiasLaborables } from "./dateUtils";

export const calcularAutomatico = (process: any) => {
    return {
        proceso: process.estado || null,

        statusAduana: calcularStatusAduana(process),

        tiempoTransitoInternacional:
            calcularTiempoTransitoInternacional(process),

        diasLabEnvioElectronicoSalidaAutorizada:
            calcularDiasLabEnvioElectronicoSalidaAutorizada(process),

        diasLabEtaSalidaAutorizada:
            calcularDiasLabEtaSalidaAutorizada(process),

        diasCalLlegadaPuertoDespachoPuerto:
            calcularDiasLlegadaDespachoPuerto(process),

        diasCalBodegaLlegadaPuerto:
            calcularDiasCalBodegaLlegadaPuerto(process),

        diasLabFacturacion:
            calcularDiasLabFacturacion(process),

        diasHabilesRealEtaEnvioElectronico:
            calcularDiasHabilesRealEtaEnvioElectronico(process),

        diasHabilesRealEnvioDesaduanizacion:
            calcularDiasHabilesRealEnvioDesaduanizacion(process),
    };
};

/**
 * =========================
 * STATUS ADUANA
 * =========================
 */
const calcularStatusAduana = (process: any): string | null => {
    if (process.despacho?.fechaRealDespachoPuerto) {
        return "DESPACHADO";
    }

    if (process.despacho?.fechaFacturacionCostos) {
        return "ENTREGADA CARPETA";
    }

    if (process.aduana?.refrendo) {
        return "REFRENDANDO";
    }

    return null;
};

/**
 * =========================
 * TIEMPO DE TRÁNSITO INTERNACIONAL
 * =========================
 * Días calendario entre:
 * fecha real de embarque y fecha real llegada a puerto
 */
const calcularTiempoTransitoInternacional = (process: any): number | null => {
    const fechaEmbarque = process?.postembarque?.fechaRealEmbarque;
    const fechaLlegada = process?.postembarque?.fechaRealLlegadaPuerto;

    if (!fechaEmbarque || !fechaLlegada) return null;

    const msPorDia = 1000 * 60 * 60 * 24;
    const diffMs =
        new Date(fechaLlegada).getTime() -
        new Date(fechaEmbarque).getTime();

    if (diffMs < 0) return 0;

    return Math.floor(diffMs / msPorDia);
};

/**
 * =========================
 * ENVÍO ELECTRÓNICO → SALIDA AUTORIZADA
 * =========================
 * Días laborables
 */
const calcularDiasLabEnvioElectronicoSalidaAutorizada = (
    process: any
): number | null => {
    const fechaEnvio = process?.aduana?.fechaEnvioElectronico;
    const fechaSalida = process?.aduana?.fechaSalidaAutorizada;

    if (!fechaEnvio || !fechaSalida) return null;

    return calcularDiasLaborables(
        new Date(fechaEnvio),
        new Date(fechaSalida)
    );
};

/**
 * =========================
 * ETA → SALIDA AUTORIZADA
 * =========================
 * Días laborables
 */
const calcularDiasLabEtaSalidaAutorizada = (
    process: any
): number | null => {
    const fechaLlegadaPuerto =
        process?.postembarque?.fechaRealLlegadaPuerto;

    const fechaSalidaAutorizada =
        process?.aduana?.fechaSalidaAutorizada;

    if (!fechaLlegadaPuerto || !fechaSalidaAutorizada) return null;

    return calcularDiasLaborables(
        new Date(fechaSalidaAutorizada),
        new Date(fechaLlegadaPuerto)
    );
};

/**
 * =========================
 * LLEGADA PUERTO → DESPACHO PUERTO
 * =========================
 * Días calendario
 */
const calcularDiasLlegadaDespachoPuerto = (
    process: any
): number | null => {
    const fechaLlegadaPuerto =
        process?.postembarque?.fechaRealLlegadaPuerto;

    const fechaDespachoPuerto =
        process?.despacho?.fechaRealDespachoPuerto;

    if (!fechaLlegadaPuerto || !fechaDespachoPuerto) return null;

    const inicio = new Date(fechaLlegadaPuerto);
    const fin = new Date(fechaDespachoPuerto);

    const msPorDia = 1000 * 60 * 60 * 24;
    const diffMs = fin.getTime() - inicio.getTime();

    if (diffMs < 0) return 0;

    return Math.floor(diffMs / msPorDia);
};

/**
 * =========================
 * LLEGADA PUERTO → ENTREGA BODEGA
 * =========================
 * Días calendario
 */
const calcularDiasCalBodegaLlegadaPuerto = (
    process: any
): number | null => {
    const fechaLlegadaPuerto =
        process?.postembarque?.fechaRealLlegadaPuerto;

    const fechaEntregaBodega =
        process?.despacho?.fechaRealEntregaBodega;

    if (!fechaLlegadaPuerto || !fechaEntregaBodega) return null;

    const inicio = new Date(fechaLlegadaPuerto);
    const fin = new Date(fechaEntregaBodega);

    const msPorDia = 1000 * 60 * 60 * 24;
    const diffMs = fin.getTime() - inicio.getTime();

    if (diffMs < 0) return 0;

    return Math.floor(diffMs / msPorDia);
};

/**
 * =========================
 * FACTURACIÓN
 * =========================
 * FECHA FACTURACIÓN COSTOS → ENTREGA BODEGA
 * Días laborables
 */
const calcularDiasLabFacturacion = (
    process: any
): number | null => {
    const fechaFacturacion =
        process?.despacho?.fechaFacturacionCostos;

    const fechaEntregaBodega =
        process?.despacho?.fechaRealEntregaBodega;

    if (!fechaFacturacion || !fechaEntregaBodega) return null;

    return calcularDiasLaborables(
        new Date(fechaFacturacion),
        new Date(fechaEntregaBodega)
    );
};

/**
 * =========================
 * ETA → ENVÍO ELECTRÓNICO (REAL)
 * =========================
 * Días laborables
 */
export const calcularDiasHabilesRealEtaEnvioElectronico = (
    process: any
): number | null => {

    const fechaLlegadaPuerto =
        process?.postembarque?.fechaRealLlegadaPuerto;

    const fechaEnvioElectronico =
        process?.aduana?.fechaEnvioElectronico;

    const regimen =
        process?.inicio?.regimen;

    const prioridad =
        process?.inicio?.prioridad;

    const tipoTransporte =
        process?.postembarque?.tipoTransporte;

    const tipoContenedor =
        process?.despacho?.tipoContenedor;

    // ---------- Validación fechas ----------
    if (!fechaLlegadaPuerto || !fechaEnvioElectronico) return null;

    // ---------- Normalización ----------
    const regimenValido =
        ["10", "21", "91"].includes(String(regimen));

    const prioridadValida =
        ["NORMAL", "PRIORIDAD"].includes(
            prioridad?.toUpperCase()
        );

    const transporteValido =
        ["AEREO", "MARITIMO", "TERRESTRE"].includes(
            tipoTransporte?.toUpperCase()
        );

    const tipoCargaTexto =
        tipoContenedor?.toLowerCase() || "";

    const esCargaSuelta =
        tipoCargaTexto.includes("carga suelta");

    const esContenedor =
        tipoCargaTexto.includes("contenedor");

    const tipoCargaValido =
        esCargaSuelta || esContenedor;

    // ---------- Validación proceso ----------
    if (
        !regimenValido ||
        !prioridadValida ||
        !transporteValido ||
        !tipoCargaValido
    ) {
        return null;
    }

    // ---------- Protección fechas invertidas ----------
    if (fechaEnvioElectronico < fechaLlegadaPuerto) return 0;

    // ---------- Cálculo ----------
    return calcularDiasLaborables(
        new Date(fechaLlegadaPuerto),
        new Date(fechaEnvioElectronico)
    );
};


/**
 * =========================
 * ENVÍO ELECTRÓNICO → DESADUANIZACIÓN
 * =========================
 * Días laborables
 */
const calcularDiasHabilesRealEnvioDesaduanizacion = (
    process: any
): number | null => {
    const fechaEnvioElectronico =
        process?.aduana?.fechaEnvioElectronico;

    const fechaSalidaAutorizada =
        process?.aduana?.fechaSalidaAutorizada;

    if (!fechaEnvioElectronico || !fechaSalidaAutorizada) return null;

    return calcularDiasLaborables(
        new Date(fechaEnvioElectronico),
        new Date(fechaSalidaAutorizada)
    );
};
