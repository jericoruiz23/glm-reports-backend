import { calcularDiasLaborables } from "./dateUtils";

export type SLARule = {
    regimen: string[];
    via: string;
    tipoCarga: "CARGA SUELTA" | "CONTENEDOR";
    normal: number;
    prioridad: number;
};

export type SLASalidaRule = {
    regimen: string[];
    via: string;
    tipoCarga: "CARGA SUELTA" | "CONTENEDOR";
    normal: {
        automatico?: number;
        documental: number;
        fisico: number;
    };
    prioridad: {
        automatico?: number;
        documental: number;
        fisico: number;
    };
};
export type SLAEtaSalidaRule = {
    regimen: string[];
    via: string;
    tipoCarga: "CARGA SUELTA" | "CONTENEDOR";
    normal: {
        automatico: number;
        documental: number;
        fisico: number;
    };
    prioridad: {
        automatico: number;
        documental: number;
        fisico: number;
    };
};

export type SLAEntregaBodegaRule = {
    regimen: string[];
    via: string;
    tipoCarga: "CARGA SUELTA" | "CONTENEDOR";
    normal: number;
    prioridad: number;
};


export const SLA_MATRIX: SLARule[] = [
    {
        regimen: ["10"],
        via: "AEREO",
        tipoCarga: "CARGA SUELTA",
        normal: 1,
        prioridad: 1,
    },
    {
        regimen: ["10"],
        via: "AEREO COURIER - CONSUMO",
        tipoCarga: "CARGA SUELTA",
        normal: 2,
        prioridad: 1,
    },
    {
        regimen: ["20", "21", "31"],
        via: "AEREO",
        tipoCarga: "CARGA SUELTA",
        normal: 2,
        prioridad: 2,
    },
    {
        regimen: ["10", "20", "21", "31"],
        via: "MARITIMO",
        tipoCarga: "CARGA SUELTA",
        normal: -1,
        prioridad: -1,
    },
    {
        regimen: ["10", "20", "21", "31"],
        via: "MARITIMO",
        tipoCarga: "CONTENEDOR",
        normal: -1,
        prioridad: -1,
    },
    {
        regimen: ["10"],
        via: "TERRESTRE",
        tipoCarga: "CARGA SUELTA",
        normal: 2,
        prioridad: 2,
    },
    {
        regimen: ["20", "21", "31"],
        via: "TERRESTRE",
        tipoCarga: "CARGA SUELTA",
        normal: 3,
        prioridad: 2,
    },
];

export const SLA_SALIDA_MATRIX: SLASalidaRule[] = [
    {
        regimen: ["10"],
        via: "AEREO",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: 0, documental: 1, fisico: 3 },
        prioridad: { automatico: 0, documental: 1, fisico: 1 },
    },
    {
        regimen: ["10"],
        via: "MARITIMO",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: 0, documental: 3, fisico: 3 },
        prioridad: { automatico: 0, documental: 2, fisico: 3 },
    },
    {
        regimen: ["10"],
        via: "MARITIMO",
        tipoCarga: "CONTENEDOR",
        normal: { automatico: 0, documental: 2, fisico: 2 },
        prioridad: { automatico: 0, documental: 2, fisico: 2 },
    },
    {
        regimen: ["10"],
        via: "TERRESTRE",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: 0, documental: 1, fisico: 1 },
        prioridad: { automatico: 0, documental: 1, fisico: 1 },
    },
];

export const SLA_ETA_SALIDA_MATRIX: SLAEtaSalidaRule[] = [
    {
        regimen: ["10"],
        via: "AEREO",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: 1, documental: 2, fisico: 4 },
        prioridad: { automatico: 1, documental: 2, fisico: 2 },
    },
    {
        regimen: ["10"],
        via: "AEREO COURIER - CONSUMO",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: 2, documental: 3, fisico: 4 },
        prioridad: { automatico: 1, documental: 2, fisico: 2 },
    },
    {
        regimen: ["20", "21", "31"],
        via: "AEREO",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: -999, documental: 3, fisico: 4 },
        prioridad: { automatico: -999, documental: 3, fisico: 3 },
    },
    {
        regimen: ["10"],
        via: "MARITIMO",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: -1, documental: 3, fisico: 3 },
        prioridad: { automatico: -1, documental: 2, fisico: 3 },
    },
    {
        regimen: ["20", "21", "31"],
        via: "MARITIMO",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: -999, documental: 3, fisico: 3 },
        prioridad: { automatico: -999, documental: 2, fisico: 3 },
    },
    {
        regimen: ["10"],
        via: "MARITIMO",
        tipoCarga: "CONTENEDOR",
        normal: { automatico: -1, documental: 2, fisico: 2 },
        prioridad: { automatico: -1, documental: 2, fisico: 2 },
    },
    {
        regimen: ["20", "21", "31"],
        via: "MARITIMO",
        tipoCarga: "CONTENEDOR",
        normal: { automatico: -999, documental: 2, fisico: 2 },
        prioridad: { automatico: -999, documental: 2, fisico: 2 },
    },
    {
        regimen: ["10"],
        via: "TERRESTRE",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: 2, documental: 3, fisico: 3 },
        prioridad: { automatico: 2, documental: 3, fisico: 3 },
    },
    {
        regimen: ["20", "21", "31"],
        via: "TERRESTRE",
        tipoCarga: "CARGA SUELTA",
        normal: { automatico: -999, documental: 4, fisico: 4 },
        prioridad: { automatico: -999, documental: 3, fisico: 3 },
    },
];

export const SLA_ENTREGA_BODEGA_MATRIX: SLAEntregaBodegaRule[] = [
    {
        regimen: ["10"],
        via: "AEREO",
        tipoCarga: "CARGA SUELTA",
        normal: 0,
        prioridad: 0,
    },
    {
        regimen: ["10"],
        via: "AEREO COURIER - CONSUMO",
        tipoCarga: "CARGA SUELTA",
        normal: 0,
        prioridad: 0,
    },
    {
        regimen: ["20", "21", "31"],
        via: "AEREO",
        tipoCarga: "CARGA SUELTA",
        normal: 0,
        prioridad: 0,
    },
    {
        regimen: ["10", "20", "21", "31"],
        via: "MARITIMO",
        tipoCarga: "CARGA SUELTA",
        normal: 1,
        prioridad: 1,
    },
    {
        regimen: ["10", "20", "21", "31"],
        via: "MARITIMO",
        tipoCarga: "CONTENEDOR",
        normal: 1,
        prioridad: 1,
    },
    {
        regimen: ["10", "20", "21", "31"],
        via: "TERRESTRE",
        tipoCarga: "CARGA SUELTA",
        normal: 1,
        prioridad: 1,
    },
];


const normalizarTexto = (texto: string) =>
    texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();


export const resolverSLAEtaEnvio = (process: any): number | null => {
    const regimen = String(process?.inicio?.regimen ?? "");
    const prioridad = normalizarTexto(String(process?.inicio?.prioridad ?? ""));
    const via = normalizarTexto(String(process?.postembarque?.tipoTransporte ?? ""));
    const tipoContenedor = normalizarTexto(String(process?.despacho?.tipoContenedor ?? ""));

    if (!regimen || !prioridad || !via || !tipoContenedor) return null;

    const tipoCarga =
        tipoContenedor.includes("SUELTA")
            ? "CARGA SUELTA"
            : tipoContenedor.includes("CONTAINER") || tipoContenedor.includes("CONTENEDOR")
                ? "CONTENEDOR"
                : null;

    if (!tipoCarga) return null;

    const rule = SLA_MATRIX.find(
        (r) =>
            r.regimen.includes(regimen) &&
            r.via === via &&
            r.tipoCarga === tipoCarga
    );

    if (!rule) return null;

    return prioridad === "PRIORIDAD" ? rule.prioridad : rule.normal;
};

export const resolverSLASalidaAutorizada = (process: any): number | null => {
    const regimen = String(process?.inicio?.regimen ?? "");
    const prioridad = normalizarTexto(String(process?.inicio?.prioridad ?? ""));
    const via = normalizarTexto(String(process?.postembarque?.tipoTransporte ?? ""));
    const tipoContenedor = normalizarTexto(String(process?.despacho?.tipoContenedor ?? ""));
    const tipoAforo = normalizarTexto(String(process?.aduana?.tipoAforo ?? ""));

    if (!regimen || !prioridad || !via || !tipoContenedor || !tipoAforo)
        return null;


    const tipoCarga =
        tipoContenedor.includes("SUELTA")
            ? "CARGA SUELTA"
            : tipoContenedor.includes("CONTAINER") || tipoContenedor.includes("CONTENEDOR")
                ? "CONTENEDOR"
                : null;


    if (!tipoCarga) return null;

    const rule = SLA_SALIDA_MATRIX.find(
        (r) =>
            r.regimen.includes(regimen) &&
            r.via === via &&
            r.tipoCarga === tipoCarga
    );

    if (!rule) return null;

    // Mapear tipoAforo
    let tipo: "automatico" | "documental" | "fisico" | null = null;

    if (tipoAforo.includes("AUTOMATICO")) tipo = "automatico";
    else if (tipoAforo.includes("DOCUMENTAL")) tipo = "documental";
    else if (tipoAforo.includes("FISICO")) tipo = "fisico";


    if (!tipo) return null;

    const config = prioridad === "PRIORIDAD"
        ? rule.prioridad
        : rule.normal;

    return config[tipo] ?? null;
};

export const evaluarEnvioElectronicoSalida = (process: any) => {
    const fechaEnvio = process?.aduana?.fechaEnvioElectronico;
    const fechaSalida = process?.aduana?.fechaSalidaAutorizada;

    if (!fechaEnvio || !fechaSalida) return null;

    const sla = resolverSLASalidaAutorizada(process);
    if (sla === null) return null;

    const dias = calcularDiasLaborables(
        new Date(fechaEnvio),
        new Date(fechaSalida)
    );

    const diferencia = dias - sla;

    return {
        sla,
        diasReales: dias,
        atrasado: diferencia > 0,
        diferencia: diferencia > 0 ? diferencia : 0,
    };
};

export const resolverSLAEtaSalidaAutorizada = (process: any): number | null => {
    const regimen = String(process?.inicio?.regimen ?? "");
    const prioridad = normalizarTexto(String(process?.inicio?.prioridad ?? ""));
    const via = normalizarTexto(String(process?.postembarque?.tipoTransporte ?? ""));
    const tipoContenedor = normalizarTexto(String(process?.despacho?.tipoContenedor ?? ""));
    const tipoAforo = normalizarTexto(String(process?.aduana?.tipoAforo ?? ""));

    if (!regimen || !prioridad || !via || !tipoContenedor || !tipoAforo)
        return null;

    const tipoCarga =
        tipoContenedor.includes("SUELTA")
            ? "CARGA SUELTA"
            : tipoContenedor.includes("CONTAINER") || tipoContenedor.includes("CONTENEDOR")
                ? "CONTENEDOR"
                : null;

    if (!tipoCarga) return null;

    const rule = SLA_ETA_SALIDA_MATRIX.find(
        (r) =>
            r.regimen.includes(regimen) &&
            r.via === via &&
            r.tipoCarga === tipoCarga
    );

    if (!rule) return null;

    let tipo: "automatico" | "documental" | "fisico" | null = null;

    if (tipoAforo.includes("AUTOMATICO")) tipo = "automatico";
    else if (tipoAforo.includes("DOCUMENTAL")) tipo = "documental";
    else if (tipoAforo.includes("FISICO")) tipo = "fisico";

    if (!tipo) return null;

    const config = prioridad === "PRIORIDAD"
        ? rule.prioridad
        : rule.normal;

    const sla = config[tipo];

    // si es -999 significa que no aplica
    if (sla === -999) return null;

    return sla;
};

export const resolverSLAEntregaBodega = (process: any): number | null => {
    const regimen = String(process?.inicio?.regimen ?? "");
    const prioridad = normalizarTexto(String(process?.inicio?.prioridad ?? ""));
    const via = normalizarTexto(String(process?.postembarque?.tipoTransporte ?? ""));
    const tipoContenedor = normalizarTexto(String(process?.despacho?.tipoContenedor ?? ""));

    if (!regimen || !prioridad || !via || !tipoContenedor) return null;

    const tipoCarga =
        tipoContenedor.includes("SUELTA")
            ? "CARGA SUELTA"
            : tipoContenedor.includes("CONTAINER") || tipoContenedor.includes("CONTENEDOR")
                ? "CONTENEDOR"
                : null;

    if (!tipoCarga) return null;

    const rule = SLA_ENTREGA_BODEGA_MATRIX.find(
        (r) =>
            r.regimen.includes(regimen) &&
            r.via === via &&
            r.tipoCarga === tipoCarga
    );

    if (!rule) return null;

    return prioridad === "PRIORIDAD" ? rule.prioridad : rule.normal;
};
