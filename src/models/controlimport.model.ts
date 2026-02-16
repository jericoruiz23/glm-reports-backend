import { Schema, model, Types } from "mongoose";
import { calcularAutomatico } from "../utils/calcs";

const ProcessSchema = new Schema(
    {
        // -------------------------
        // META DEL PROCESO
        // -------------------------
        proceso: {
            type: String,
            required: true,
            index: true,
        },

        codigoImportacion: {
            type: String,
            index: true,
        },



        // -------------------------
        // FORM - INICIO
        // -------------------------
        inicio: {
            prioridad: {
                type: String,
                enum: ["NORMAL", "PRIORIDAD"],
                // default: "Normal",
            },
            codigoImportacion: String,
            proveedor: String,
            facturaComercial: String,
            ordenCompra: String,
            regimen: String,
            descripcion: String,
            notificacionBroker: Date,
            referencia: String,
        },


        estado: {
            type: String,
            enum: [
                "aduana",
                "anulado",
                "concluido",
                "historico",
                "por despachar origen",
                "transito"
            ],
            default: "aduana",
            index: true,
        },
        anulado: {
            type: Boolean,
            default: false,
        },

        // -------------------------
        // FORM - PREEMBARQUE
        // -------------------------
        preembarque: {
            paisOrigen: String,
            fechaFactura: Date,
            valorFactura: Number,
            formaPago: String,
            cantidad: Number,
            um: String,

            items: [
                {
                    codigo: String,
                    descripcion: String,
                    quintalesSolicitados: Number,
                    cajasSolicitados: Number,
                    quintalesDespachados: Number,
                    cajasDespachados: Number,
                    causalesRetraso: String,
                    novedadesDescarga: String,
                    anomaliasTemperatura: String,
                    puertoArribo: String,
                    marca: String,
                    sku: String,
                    semanaIngresoBodega: Number,
                    year: Number,
                    semSolicitud: Number,
                    deltaReqVsCarga: Number,
                    deltaFechaSolicitudVsETD: Date,
                    deltaFechaSolicitudVsCarga: Date,
                    ltFechaCargaHastaIngresoBodega: Date,
                    ltHastaRoundTripWeek: Number,
                    month: Number,
                    semRequerida: Number,
                    onTime: String,
                    ttTender: Number,
                    deltaTiempoTransito: Number,
                    satUN: Number,
                    satCONT: Number,
                    fletePrimario: Number,
                    otros: Number,
                    seguro: Number,
                    sumaTotal: Number,
                }
            ],

            entidadEmisoraDcp: String,
            numeroPermisoImportacion: String,
            fechaSolicitudRegimen: Date,
            cartaReg21: String,

            fechaSolicitudGarantia: Date,
            aseguradora: String,
            numeroGarantia: String,
            montoAsegurado: Number,
            fechaInicioGarantia: Date,
            fechaFinGarantia: Date,
            numeroCdaGarantia: String,

            fechaEnvioPoliza: Date,
            fechaRecepcionDocumentoOriginal: Date,
            numeroPoliza: String,
            incoterms: String,

            fechaRecolectEstimada: Date,
            fechaRecolectProveedor: Date,
            fechaRecolectReal: Date,

            fechaReqBodega: Date,
            fechaMaxReqBodega: Date,

            cartaAclaratoria: String,
            certificadoOrigen: String,
            listaEmpaque: String,
            cartaGastos: String,
            paisProcedencia: String,
            calloff: String,
            fechaCalloff: Date,
        },

        // -------------------------
        // FORM - POSTEMBARQUE
        // -------------------------
        postembarque: {
            blMaster: String,
            blHijo: String,
            tipoTransporte: String,
            companiaTransporte: String,
            forwarder: String,

            fechaEstEmbarque: Date,
            fechaRealEmbarque: Date,
            fechaEstLlegadaPuerto: Date,
            fechaRealLlegadaPuerto: Date,

            numeroGuia: String,
            fechaRecepcionDocsOriginales: Date,
            puertoEmbarque: String,
        },

        // -------------------------
        // FORM - ADUANA
        // -------------------------
        aduana: {
            fechaEnvioElectronico: Date,
            fechaPagoLiquidacion: Date,
            fechaSalidaAutorizada: Date,
            tipoAforo: String,
            refrendo: String,
            numeroEntregaEcuapass: String,
            numeroLiquidacion: String,
            numeroCdaAutorizacion: String,
            numeroCarga: String,
            statusAduana: String,
        },

        // -------------------------
        // FORM - DESPACHO
        // -------------------------
        despacho: {
            fechaFacturacionCostos: Date,
            numeroContainer: String,
            peso: Number,
            bultos: Number,
            tipoContenedor: String,

            fechaEstDespachoPuerto: Date,
            fechaRealDespachoPuerto: Date,
            fechaEstEntregaBodega: Date,
            fechaRealEntregaBodega: Date,

            diasLibres: Number,
            confirmadoNaviera: Number,
            fechaCas: Date,
            fechaEntregaContenedorVacio: Date,

            almacenaje: Number,
            demorraje: Number,
            observaciones: String,
            fechaRegistroPesos: Date,
        },

        // -------------------------
        // FORM - CAMBIO AUTOMÁTICO
        // -------------------------
        automatico: {
            proceso: String,
            statusAduana: String,
            tiempoTransitoInternacional: Number,
            diasLabEnvioElectronicoSalidaAutorizada: Number,
            diasLabEtaSalidaAutorizada: Number,
            diasCalLlegadaPuertoDespachoPuerto: Number,
            diasCalBodegaLlegadaPuerto: Number,
            diasLabFacturacion: Number,
            observacionesCarpetas: String,
            rangoEnvioElectronicoSalida: Number,
            rangoEtaEnvioElectronico: Number,
            rangoCarpetas: Number,
            diasHabilesRealEtaEnvioElectronico: Number,
            diasHabilesRealEnvioDesaduanizacion: Number,
        },

        currentStage: {
            type: String,
            enum: ["inicio", "preembarque", "postembarque", "aduana", "despacho", "finalizado"],
            default: "inicio",
            index: true,
        },
    },
    {
        timestamps: true,
        minimize: false, // 🔥 CLAVE
    }


);

// Función para calcular el estado automáticamente según los campos
export function calcularEstado(proceso: {
    anulado: boolean;
    despacho: { fechaFacturacionCostos?: Date; fechaRealDespachoPuerto?: Date };
    postembarque: { fechaRealEmbarque?: Date; fechaRealLlegadaPuerto?: Date };
    currentStage: string;
}) {
    if (proceso.anulado) return "anulado";
    if (proceso.despacho?.fechaFacturacionCostos) return "historico";
    if (proceso.despacho?.fechaRealDespachoPuerto) return "concluido";
    if (proceso.postembarque?.fechaRealEmbarque) return "transito";
    if (proceso.postembarque?.fechaRealLlegadaPuerto) return "aduana";
    if (proceso.currentStage === "inicio") return "por despachar origen";

    // Opcional: si quieres tener un fallback seguro
    return "por despachar origen";
}

ProcessSchema.pre("save", function (next) {
    this.automatico = {
        ...this.automatico,
        ...calcularAutomatico(this),
    };
    next();
});

export const Process = model("Process", ProcessSchema);
