import { calcularDiasLaborables } from "../utils/dateUtils";
import { resolverSLAEntregaBodega, resolverSLAEtaEnvio, resolverSLAEtaSalidaAutorizada } from "./slaMatrix";

export const evaluarEtaEnvioElectronico = (process: any) => {
    const fechaETA = process?.postembarque?.fechaRealLlegadaPuerto;
    const fechaEnvio = process?.aduana?.fechaEnvioElectronico;

    if (!fechaETA || !fechaEnvio) return null;

    const sla = resolverSLAEtaEnvio(process);
    if (sla === null) return null;

    const eta = new Date(fechaETA);
    const envio = new Date(fechaEnvio);

    eta.setUTCHours(12, 0, 0, 0);
    envio.setUTCHours(12, 0, 0, 0);




    const diasReales = calcularDiasLaborables(eta, envio);

    // =========================
    // SLA POSITIVO (tolerancia)
    // =========================
    if (sla > 0) {
        const atrasado = diasReales > sla;

        return {
            sla,
            tipoRegla: "TOLERANCIA",
            diasReales,
            atrasado,
            diferencia: atrasado ? diasReales - sla : 0,
        };
    }

    // =========================
    // SLA NEGATIVO (exacto antes)
    // =========================
    if (sla < 0) {
        const diasAnticipacion = Math.abs(sla);

        // restar días hábiles manualmente
        let fechaObjetivo = new Date(eta);
        let count = 0;

        while (count < diasAnticipacion) {
            fechaObjetivo.setDate(fechaObjetivo.getDate() - 1);
            const day = fechaObjetivo.getDay();
            if (day !== 0 && day !== 6) {
                count++;
            }
        }

        const cumple = envio.getTime() === fechaObjetivo.getTime();

        return {
            sla,
            tipoRegla: "EXACTO_ANTICIPADO",
            fechaObjetivo,
            diasReales,
            atrasado: !cumple,
        };
    }

    return null;
};

export const evaluarEtaSalidaAutorizada = (process: any) => {
    console.log("EVALUANDO ETA SALIDA", process._id);
    const fechaETA = process?.postembarque?.fechaRealLlegadaPuerto;
    const fechaSalida = process?.aduana?.fechaSalidaAutorizada;

    if (!fechaETA || !fechaSalida) return null;

    const sla = resolverSLAEtaSalidaAutorizada(process);
    if (sla === null) return null;

    const eta = new Date(fechaETA);
    const salida = new Date(fechaSalida);

    eta.setUTCHours(12, 0, 0, 0);
    salida.setUTCHours(12, 0, 0, 0);

    const diasReales = calcularDiasLaborables(salida, eta);

    // =========================
    // SLA POSITIVO (tolerancia)
    // =========================
    if (sla > 0) {
        const atrasado = diasReales > sla;

        return {
            sla,
            tipoRegla: "TOLERANCIA",
            diasReales,
            atrasado,
            diferencia: atrasado ? diasReales - sla : 0,
        };
    }

    // =========================
    // SLA NEGATIVO (exacto anticipado)
    // =========================
    if (sla < 0) {
        const diasAnticipacion = Math.abs(sla);

        let fechaObjetivo = new Date(eta);
        let count = 0;

        while (count < diasAnticipacion) {
            fechaObjetivo.setUTCDate(fechaObjetivo.getUTCDate() - 1);
            const day = fechaObjetivo.getUTCDay();
            if (day !== 0 && day !== 6) {
                count++;
            }
        }

        const cumple = salida.getTime() === fechaObjetivo.getTime();

        return {
            sla,
            tipoRegla: "EXACTO_ANTICIPADO",
            fechaObjetivo,
            diasReales,
            atrasado: !cumple,
        };
    }

    return null;
};

export const evaluarEntregaBodega = (process: any) => {
    const fechaInicio = process?.aduana?.fechaSalidaAutorizada;
    const fechaEntrega = process?.despacho?.fechaRealEntregaBodega;

    const sla = resolverSLAEntregaBodega(process);
    if (sla === null) return null;

    if (!fechaInicio || !fechaEntrega) {
        return {
            sla,
            tipoRegla: "TOLERANCIA",
            diasReales: null,
            atrasado: null,
            diferencia: null,
        };
    }

    const dias = calcularDiasLaborables(
        new Date(fechaInicio),
        new Date(fechaEntrega)
    );

    const diferencia = dias - sla;

    return {
        sla,
        tipoRegla: "TOLERANCIA",
        diasReales: dias,
        atrasado: diferencia > 0,
        diferencia: diferencia > 0 ? diferencia : 0,
    };
};
