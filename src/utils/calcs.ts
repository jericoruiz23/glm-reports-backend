
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

    if (!fechaLlegadaPuerto || !fechaEnvioElectronico) return null;

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

    if (
        !regimenValido ||
        !prioridadValida ||
        !transporteValido ||
        !tipoCargaValido
    ) {
        return null;
    }

    if (fechaEnvioElectronico < fechaLlegadaPuerto) return 0;

    return calcularDiasLaborables(
        new Date(fechaLlegadaPuerto),
        new Date(fechaEnvioElectronico)
    );
};

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
