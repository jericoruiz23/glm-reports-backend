import * as XLSX from "xlsx-js-style";
import { WorkBook } from "xlsx-js-style";

export interface IngestResult {
    procesos: any[];
    errores: string[];
}

/* ======================================================
   Main parser
====================================================== */
export const parseIngestExcel = (buffer: Buffer): IngestResult => {
    const errores: string[] = [];
    const procesosMap = new Map<string, any>();

    const wb: WorkBook = XLSX.read(buffer, { type: "buffer" });

    const requiredSheets = [
        "INICIO",
        "PREEMBARQUE",
        "ITEMS",
        "POSTEMBARQUE",
        "ADUANA",
        "DESPACHO",
    ];

    for (const sheet of requiredSheets) {
        if (!wb.Sheets[sheet]) {
            errores.push(`Falta la hoja ${sheet}`);
        }
    }

    if (errores.length) {
        return { procesos: [], errores };
    }

    /* ======================================================
       INICIO
    ====================================================== */
    XLSX.utils.sheet_to_json<any>(wb.Sheets["INICIO"]).forEach(row => {
        const procesoKey = normalizeKey(row.PROCESO);
        if (!procesoKey) return;

        const codigoImportacion = get(row, [
            "CÓDIGO IMPORTACIÓN",
            "CODIGO IMPORTACION",
        ]);

        procesosMap.set(procesoKey, {
            proceso: procesoKey,
            codigoImportacion,

            inicio: {
                prioridad: row.PRIORIDAD ?? null,
                codigoImportacion,
                proveedor: row.PROVEEDOR ?? null,
                facturaComercial: row["FACTURA COMERCIAL"] ?? null,
                ordenCompra: row["ORDEN COMPRA"] ?? null,
                regimen: row["RÉGIMEN"] ?? null,
                descripcion: row["DESCRIPCIÓN"] ?? null,
                referencia: row.REFERENCIA ?? null,
                notificacionBroker: parseDate(
                    row["NOTIFICACIÓN BROKER (YYYY-MM-DD)"]
                ),
            },

            preembarque: { items: [] as any[] },
            postembarque: {},
            aduana: {},
            despacho: {},
        });
    });

    /* ======================================================
       PREEMBARQUE
    ====================================================== */
    XLSX.utils.sheet_to_json<any>(wb.Sheets["PREEMBARQUE"]).forEach(row => {
        const procesoKey = normalizeKey(row.PROCESO);
        if (!procesoKey) return;

        const proc = procesosMap.get(procesoKey);
        if (!proc) return;

        Object.assign(proc.preembarque, {
            paisOrigen: row["PAÍS ORIGEN"] ?? null,
            fechaFactura: parseDate(row["FECHA FACTURA (YYYY-MM-DD)"]),
            valorFactura: row["VALOR FACTURA"] ?? null,
            formaPago: row["FORMA PAGO"] ?? null,
            cantidad: row.CANTIDAD ?? null,
            um: row.UM ?? null,
            entidadEmisoraDcp: row["ENTIDAD EMISORA DCP"] ?? null,
            numeroPermisoImportacion: row["N° PERMISO IMPORTACIÓN"] ?? null,
            incoterms: row.INCOTERMS ?? null,
            paisProcedencia: row["PAÍS PROCEDENCIA"] ?? null,
        });
    });

    /* ======================================================
       ITEMS (N por proceso)
    ====================================================== */
    XLSX.utils.sheet_to_json<any>(wb.Sheets["ITEMS"]).forEach(row => {
        const procesoKey = normalizeKey(row.PROCESO);
        if (!procesoKey) return;

        const proc = procesosMap.get(procesoKey);
        if (!proc) return;


        if (!proc.preembarque.items) {
            proc.preembarque.items = [];
        }

        proc.preembarque.items.push({
            codigo: row["CÓDIGO"] ?? null,
            descripcion: row["DESCRIPCIÓN"] ?? null,
            quintalesSolicitados: row["QUINTALES SOLICITADOS"] ?? null,
            cajasSolicitados: row["CAJAS SOLICITADAS"] ?? null,
            quintalesDespachados: row["QUINTALES DESPACHADOS"] ?? null,
            cajasDespachados: row["CAJAS DESPACHADOS"] ?? null,
            causalesRetraso: row["CAUSALES RETRASO"] ?? null,
            novedadesDescarga: row["NOVEDADES DESCARGA"] ?? null,
            anomaliasTemperatura: get(row, [
                "ANOMALÍAS TEMPERATURA",
                "ANOMALIAS TEMPERATURA",
                "ANOMALIAS_TEMPERATURA",
            ]),
            puertoArribo: row["PUERTO ARRIBO"] ?? null,
            marca: row.MARCA ?? null,
            sku: row.SKU ?? null,
            semanaIngresoBodega: row["SEMANA INGRESO BODEGA"] ?? null,
            year: row.AÑO ?? null,
            month: row.MES ?? null,
            sumaTotal: row["SUMA TOTAL"] ?? null,
        });
    });

    /* ======================================================
       POSTEMBARQUE
    ====================================================== */
    XLSX.utils.sheet_to_json<any>(wb.Sheets["POSTEMBARQUE"]).forEach(row => {
        const procesoKey = normalizeKey(row.PROCESO);
        if (!procesoKey) return;

        const proc = procesosMap.get(procesoKey);
        if (!proc) return;


        Object.assign(proc.postembarque, {
            blMaster: row["BL MASTER"] ?? null,
            blHijo: row["BL HIJO"] ?? null,
            tipoTransporte: row["TIPO TRANSPORTE"] ?? null,
            companiaTransporte: row["COMPAÑÍA TRANSPORTE"] ?? null,
            forwarder: row.FORWARDER ?? null,
            fechaRealEmbarque: parseDate(row["FECHA REAL EMBARQUE"]),
            fechaRealLlegadaPuerto: parseDate(
                row["FECHA REAL LLEGADA PUERTO"]
            ),
            puertoEmbarque: row["PUERTO EMBARQUE"] ?? null,
        });
    });

    /* ======================================================
       ADUANA
    ====================================================== */
    XLSX.utils.sheet_to_json<any>(wb.Sheets["ADUANA"]).forEach(row => {
        const procesoKey = normalizeKey(row.PROCESO);
        if (!procesoKey) return;

        const proc = procesosMap.get(procesoKey);
        if (!proc) return;


        Object.assign(proc.aduana, {
            fechaEnvioElectronico: parseDate(
                row["FECHA ENVÍO ELECTRÓNICO"]
            ),
            fechaSalidaAutorizada: parseDate(
                row["FECHA SALIDA AUTORIZADA"]
            ),
            tipoAforo: row["TIPO AFORO"] ?? null,
            statusAduana: row["STATUS ADUANA"] ?? null,
        });
    });

    /* ======================================================
       DESPACHO
    ====================================================== */
    XLSX.utils.sheet_to_json<any>(wb.Sheets["DESPACHO"]).forEach(row => {
        const procesoKey = normalizeKey(row.PROCESO);
        if (!procesoKey) return;

        const proc = procesosMap.get(procesoKey);
        if (!proc) return;


        Object.assign(proc.despacho, {
            numeroContainer: row["N° CONTAINER"] ?? null,
            peso: row.PESO ?? null,
            bultos: row.BULTOS ?? null,
            tipoContenedor: row["TIPO CONTENEDOR"] ?? null,
            fechaRealDespachoPuerto: parseDate(
                row["FECHA REAL DESPACHO PUERTO"]
            ),
            fechaRealEntregaBodega: parseDate(
                row["FECHA REAL ENTREGA BODEGA"]
            ),
        });
    });

    return {
        procesos: Array.from(procesosMap.values()),
        errores,
    };
};

/* ======================================================
   Utils
====================================================== */

const normalizeKey = (value: any): string | null => {
    if (value === undefined || value === null) return null;
    const v = String(value).trim();
    return v.length ? v : null;
};

const get = (row: any, keys: string[]) =>
    keys.map(k => row[k]).find(v => v !== undefined) ?? null;

const parseDate = (value: any): Date | null => {
    if (!value) return null;

    if (value instanceof Date) {
        return value;
    }

    if (typeof value === "number") {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + value * 86400000);
    }

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
};
