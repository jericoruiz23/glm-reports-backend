import { Request, Response } from "express";
import { Process, calcularEstado } from "../models/controlimport.model";
import { Counter } from "../models/counter.model";
import { evaluarEntregaBodega, evaluarEtaEnvioElectronico, evaluarEtaSalidaAutorizada } from "../utils/sla.service";
import { evaluarEnvioElectronicoSalida } from "../utils/slaMatrix";
// Crear un nuevo proceso con items completos
const extractSeqFromCodigo = (codigo: string): number | null => {
    if (!codigo) return null;

    const parts = codigo.split("-");
    if (parts.length < 4) return null;

    const seq = Number(parts[3]);
    return Number.isFinite(seq) ? seq : null;
};

export const createProcess = async (req: Request, res: Response) => {
    try {
        const {
            tipo,
            regimenSel,
            extensiones = [],
            proveedor,
            facturaComercial,
            numeroOrdenCompra,
            descripcion,
            referencia,
            prioridad,
            notificacionRecibidaBroker,
            paisOrigen,
            fechaFactura,
            valorFactura,
            items = [],
            codigoImportacion: codigoFromFront, // 👈 editable desde el front
        } = req.body;

        const year = new Date().getFullYear();

        // ===============================
        // 1. Intentar usar secuencial del código ingresado
        // ===============================
        const userSeq = extractSeqFromCodigo(codigoFromFront);

        const counter = await Counter.findById("IMPORT_GLOBAL");

        if (!counter) {
            return res.status(500).json({
                message: "Contador IMPORT_GLOBAL no inicializado",
            });
        }

        let finalSeq: number;

        if (userSeq !== null) {

            // 👇 AQUÍ MISMO VA
            const exists = await Process.exists({
                codigoImportacion: {
                    $regex: `-${String(userSeq).padStart(3, "0")}(?:-|$)`
                }
            });

            if (exists) {
                return res.status(409).json({
                    message: `El secuencial ${userSeq} ya existe`,
                });
            }

            finalSeq = userSeq;

            // solo avanzamos el contador si el usuario se fue hacia arriba
            if (userSeq > (counter.seq ?? 0)) {
                counter.seq = userSeq;
                await counter.save();
            }

        } else {
            finalSeq = Number(await nextSeq("IMPORT_GLOBAL"));
        }

        const normalizeDate = (value?: string | Date | null) => {
            if (!value) return null;
            const d = new Date(value);
            d.setUTCHours(12, 0, 0, 0);
            return d;
        };


        // ===============================
        // 2. Construir código oficial
        // ===============================
        let codigoImportacion = `${tipo}-${regimenSel}-${year}-${String(finalSeq).padStart(3, "0")}`;

        extensiones.forEach((_: any, idx: number) => {
            codigoImportacion += `-${String(idx + 1).padStart(3, "0")}`;
        });

        // ===============================
        // 4. Crear proceso
        // ===============================
        const process = new Process({
            proceso: tipo,
            codigoImportacion,
            inicio: {
                codigoImportacion,
                proveedor,
                facturaComercial,
                ordenCompra: numeroOrdenCompra,
                regimen: regimenSel,
                descripcion,
                referencia,
                prioridad,
                notificacionBroker: normalizeDate(notificacionRecibidaBroker),
            },
            preembarque: {
                paisOrigen,
                fechaFactura: normalizeDate(fechaFactura),
                valorFactura,
                items,
            },
            currentStage: "inicio",
            anulado: false,
            despacho: {
                fechaFacturacionCostos: null,
                fechaRealDespachoPuerto: null,
            },
            postembarque: {
                fechaRealEmbarque: null,
            },
        });

        // ===============================
        // 5. Calcular estado
        // ===============================
        process.estado = calcularEstado(process as any);

        await process.save();

        res.status(201).json(process);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating process" });
    }
};

// Actualizar una etapa del proceso, incluyendo items completos
export const updateStage = async (req: Request, res: Response) => {
    try {
        const { id, stage } = req.params;
        const data = req.body;

        if (!["inicio", "preembarque", "postembarque", "aduana", "despacho", "automatico"].includes(stage)) {
            return res.status(400).json({ message: "Invalid stage" });
        }

        // Normalizar fechas en un objeto recursivamente
        const normalizeDatesInObject = (obj: any): any => {
            if (!obj || typeof obj !== "object") return obj;
            if (Array.isArray(obj)) return obj.map(normalizeDatesInObject);

            const result: any = {};
            for (const [key, val] of Object.entries(obj)) {
                if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(val)) {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                        d.setUTCHours(12, 0, 0, 0);
                        result[key] = d;
                    } else {
                        result[key] = val;
                    }
                } else if (val && typeof val === "object") {
                    result[key] = normalizeDatesInObject(val);
                } else {
                    result[key] = val;
                }
            }
            return result;
        };

        const { prioridad, items, ...stageData } = data;
        const normalizedStageData = normalizeDatesInObject(stageData);
        const updatePayload: any = { [stage]: normalizedStageData };

        // Si vienen items, los asignamos directamente (normalizados)
        if (items) updatePayload[stage].items = normalizeDatesInObject(items);

        // Actualizar currentStage solo si avanza
        const stageOrder = ["inicio", "preembarque", "postembarque", "aduana", "despacho", "finalizado"];
        const currentProcess = await Process.findById(id);
        if (!currentProcess) return res.status(404).json({ message: "Process not found" });

        const currentIdx = stageOrder.indexOf(currentProcess.currentStage);
        const newIdx = stageOrder.indexOf(stage);
        if (newIdx > currentIdx) updatePayload.currentStage = stage;

        if (prioridad) updatePayload[stage].prioridad = prioridad;

        console.log(`[updateStage] Actualizando etapa ${stage} para ID ${id}`);
        console.log(`[updateStage] Payload:`, JSON.stringify(updatePayload, null, 2));

        const updatedProcess = await Process.findByIdAndUpdate(id, updatePayload, { new: true });
        if (!updatedProcess) return res.status(404).json({ message: "Process not found" });

        console.log(`[updateStage] findByIdAndUpdate exitoso. Recalculando estado...`);

        // Recalcular estado automáticamente
        try {
            updatedProcess.estado = calcularEstado(updatedProcess as any);
            console.log(`[updateStage] Nuevo estado calculado: ${updatedProcess.estado}`);
            await updatedProcess.save();
            console.log(`[updateStage] .save() exitoso (fechas normalizadas)`);
        } catch (saveError: any) {
            console.error(`[updateStage] ❌ Error en .save() secundario:`, saveError);
            // No retornamos error 500 aquí porque el update principal YA se hizo.
            // Podríamos retornar 200 con un warning, o dejar que falle si es crítico.
            throw saveError;
        }

        res.json(updatedProcess);

    } catch (err: any) {
        console.error(`[updateStage] ❌ Error general:`, err);
        console.error(err.stack);
        res.status(500).json({ message: "Error updating stage", error: err.message });
    }
};

// Obtener todos los procesos

export const getProcesses = async (req: Request, res: Response) => {
    try {
        const processes = await Process.find().lean();

        const enriched = processes.map((p) => ({
            ...p,
            metricasTransito: {
                etaEnvioElectronico: evaluarEtaEnvioElectronico(p),
                envioElectronicoSalidaAutorizada: evaluarEnvioElectronicoSalida(p),
                etaSalidaAutorizada: evaluarEtaSalidaAutorizada(p),
                entregaEnBodega: evaluarEntregaBodega(p),
            },

        }));


        res.json(enriched);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching processes" });
    }
};

// Obtener un proceso por ID
export const getProcessById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const process = await Process.findById(id);
        if (!process) return res.status(404).json({ message: "Process not found" });
        res.json(process);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching process" });
    }
};

// Actualizar todo el proceso (incluyendo inicio con prioridad)
// En tu controlador (backend)

export const updateProcess = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const payload = req.body;
        // 🔥 Capturamos el itemId que enviamos desde el front
        const { itemId } = req.body;

        const stageNames = ["inicio", "preembarque", "postembarque", "aduana", "despacho", "automatico"] as const;

        // Normalizar fechas a mediodía UTC
        const normalizeDate = (value?: string | Date | null) => {
            if (!value) return null;
            const d = new Date(value);
            if (isNaN(d.getTime())) return value; // no es fecha, dejar como está
            d.setUTCHours(12, 0, 0, 0);
            return d;
        };

        // Detectar si un valor es una fecha ISO string
        const looksLikeDate = (val: any): boolean => {
            if (val instanceof Date) return true;
            if (typeof val !== "string") return false;
            // Patrón ISO date: 2024-01-15 o 2024-01-15T...
            return /^\d{4}-\d{2}-\d{2}(T|$)/.test(val);
        };

        const proc = await Process.findById(id);
        if (!proc) return res.status(404).json({ message: "Process not found" });

        for (const stage of stageNames) {
            if (payload[stage]) {
                if (!(proc as any)[stage]) (proc as any)[stage] = {};

                for (const [key, value] of Object.entries(payload[stage])) {
                    if (value !== undefined) {

                        // 🔥 LÓGICA CORREGIDA PARA ITEMS (ARRAY)
                        if (stage === "preembarque" && key === "items") {
                            // Si estamos editando items y tenemos un ID específico
                            if (itemId && proc.preembarque?.items) {
                                // Mongoose permite buscar subdocumentos por ID
                                const itemToUpdate = proc.preembarque.items.id(itemId);

                                if (itemToUpdate) {
                                    // 'value' aquí es el objeto { codigo:..., deltaFecha... }
                                    // Iteramos y actualizamos solo lo que cambió en ESE item
                                    for (const [itemKey, itemVal] of Object.entries(value as object)) {
                                        if (itemVal !== undefined) {
                                            (itemToUpdate as any)[itemKey] = looksLikeDate(itemVal)
                                                ? normalizeDate(itemVal as string)
                                                : itemVal;
                                        }
                                    }
                                }
                            }
                            // IMPORTANTE: Continue para evitar que el código genérico de abajo
                            // sobrescriba el array 'items' completo con un objeto.
                            continue;
                        }

                        // Lógica genérica normal para el resto de campos
                        // Normalizar si parece una fecha
                        (proc as any)[stage][key] = looksLikeDate(value)
                            ? normalizeDate(value as string)
                            : value;

                        // Sincronización (Tu código original)
                        if (stage === "inicio" && key === "codigoImportacion") {
                            proc.codigoImportacion = value as string;
                        }
                    }
                }
            }
        }

        // Sincronización global
        if (proc.inicio?.codigoImportacion) {
            proc.codigoImportacion = proc.inicio.codigoImportacion;
        }

        proc.estado = calcularEstado(proc as any);
        await proc.save(); // pre('save') también normaliza fechas como respaldo
        res.json(proc);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating process" });
    }
};

// Eliminar un proceso
export const deleteProcess = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const process = await Process.findByIdAndDelete(id);
        if (!process) return res.status(404).json({ message: "Process not found" });
        res.json({ message: "Process deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deleting process" });
    }
};

// utils/nextSeq.ts

export const nextSeq = async (id: string, pad = 3) => {
    const counter = await Counter.findOneAndUpdate(
        { _id: id },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    return String(counter.seq).padStart(pad, "0");
};

export const anularProcess = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const process = await Process.findById(id);
        if (!process) return res.status(404).json({ message: "Process not found" });

        process.anulado = true;
        process.estado = calcularEstado(process as any);

        await process.save();
        res.json({ message: "Proceso anulado", process });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al anular proceso" });
    }
};

// controllers/controlimport.controller.ts
export const previewCodigo = async (req: Request, res: Response) => {
    const { tipo, regimen, ext = 0 } = req.query;

    if (!tipo || !regimen) {
        return res.status(400).json({ message: "tipo y regimen requeridos" });
    }

    const year = new Date().getFullYear();

    const counter = await Counter.findById("IMPORT_GLOBAL");

    const nextSeq = (counter?.seq ?? 0) + 1;

    const base = `${tipo}-${regimen}-${year}-${String(nextSeq).padStart(3, "0")}`;

    let codigoCompleto = base;

    const extensionesCount = Number(ext);
    for (let i = 0; i < extensionesCount; i++) {
        codigoCompleto += `-${String(i + 1).padStart(3, "0")}`;
    }

    res.json({
        codigoBase: base,
        codigoCompleto,
    });
};

export const deleteItem = async (req: Request, res: Response) => {
    try {
        const { id, codigo } = req.params;

        const process = await Process.findById(id);
        if (!process) {
            return res.status(404).json({ message: "Process not found" });
        }

        if (!process.preembarque?.items?.length) {
            return res.status(400).json({ message: "No items found" });
        }

        const initialLength = process.preembarque.items.length;

        process.preembarque.items.splice(
            0,
            process.preembarque.items.length,
            ...process.preembarque.items.filter(item => item.codigo !== codigo)
        );

        if (process.preembarque.items.length === initialLength) {
            return res.status(404).json({ message: "Item not found" });
        }

        process.estado = calcularEstado(process as any);
        await process.save();

        res.json(process);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deleting item" });
    }
};
