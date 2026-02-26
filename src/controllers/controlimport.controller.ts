import { Request, Response } from "express";
import { Types } from "mongoose";
import { Process, calcularEstado } from "../models/controlimport.model";
import { Counter } from "../models/counter.model";
import { markProcessMetricsStale } from "../metrics/processMetrics.service";
import ProcessMetrics from "../models/processMetrics.model";
import { KPI_RULE_SET_VERSION_V1, kpisArrayToMap } from "../metrics/kpi.contract";
import { getActiveRuleSetVersion } from "../metrics/ruleSet.service";
import { METRICS_API_CONTRACT_VERSION } from "../metrics/metrics.contract";
// Crear un nuevo proceso con items completos
const extractSeqFromCodigo = (codigo: string): number | null => {
    if (!codigo) return null;

    const parts = codigo.split("-");
    if (parts.length < 4) return null;

    const seq = Number(parts[3]);
    return Number.isFinite(seq) ? seq : null;
};

// Ejecuta el marcado stale sin romper el flujo de negocio si falla.
const markProcessMetricsStaleNoFail = async (
    processDoc: any,
    context: string
) => {
    try {
        await markProcessMetricsStale(processDoc);
    } catch (error) {
        console.error(`Error marcando process_metrics como stale (${context}):`, error);
    }
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
            despacho,
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
        const toNumberIfString = (value: unknown) => {
            if (value === undefined || value === null) return null;
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (!trimmed) return null;
                const numericValue = Number(trimmed);
                return Number.isFinite(numericValue) ? numericValue : null;
            }
            return value;
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
                cantidadContenedores: toNumberIfString(despacho?.cantidadContenedores),
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
        // Fase 1: marcar materializado como stale luego de mutar el proceso.
        await markProcessMetricsStaleNoFail(process, "createProcess");

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

        // `automatico` queda de solo lectura (legacy/deprecated), no editable vía API.
        if (!["inicio", "preembarque", "postembarque", "aduana", "despacho"].includes(stage)) {
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
        if (stage === "despacho" && normalizedStageData?.cantidadContenedores !== undefined) {
            const rawCantidad = normalizedStageData.cantidadContenedores;
            const parsedCantidad =
                typeof rawCantidad === "string"
                    ? Number(rawCantidad.trim())
                    : Number(rawCantidad);
            normalizedStageData.cantidadContenedores =
                Number.isFinite(parsedCantidad) ? parsedCantidad : null;
        }
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

        const updatedProcess = await Process.findByIdAndUpdate(id, updatePayload, { new: true });
        if (!updatedProcess) return res.status(404).json({ message: "Process not found" });

        // Recalcular estado automáticamente
        updatedProcess.estado = calcularEstado(updatedProcess as any);
        await updatedProcess.save();
        // Fase 1: marcar materializado como stale luego de mutar el proceso.
        await markProcessMetricsStaleNoFail(updatedProcess, "updateStage");

        res.json(updatedProcess);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating stage" });
    }
};

// Obtener todos los procesos

export const getProcesses = async (req: Request, res: Response) => {
    try {
        // Fase 8: el modo legacy=true queda retirado del runtime.
        const legacyRequested = String(req.query.legacy ?? "false") === "true";
        if (legacyRequested) {
            return res.status(410).json({
                contractVersion: METRICS_API_CONTRACT_VERSION,
                message:
                    "legacy=true retired. Use default materialized metrics contract.",
            });
        }

        const all = String(req.query.all ?? "true") === "true";
        const page = all ? 1 : Math.max(Number(req.query.page ?? 1), 1);
        const limit = all ? 200 : Math.min(Math.max(Number(req.query.limit ?? 20), 1), 200);
        const skip = all ? 0 : (page - 1) * limit;
        const processType = String(req.query.processType ?? "").trim();
        const estado = String(req.query.estado ?? "").trim();
        const from = req.query.from ? new Date(String(req.query.from)) : null;
        const to = req.query.to ? new Date(String(req.query.to)) : null;

        const query: Record<string, unknown> = {};
        if (processType) query.proceso = processType;
        if (estado) query.estado = estado;
        if (from || to) {
            query.updatedAt = {
                ...(from ? { $gte: from } : {}),
                ...(to ? { $lte: to } : {}),
            };
        }

        // Proyeccion para listado: evita cargar campos pesados innecesarios.
        const projection =
            "_id proceso codigoImportacion estado currentStage updatedAt createdAt anulado inicio preembarque postembarque aduana despacho automatico";

        // Header de version de contrato final GA.
        res.setHeader("X-Metrics-Contract-Version", METRICS_API_CONTRACT_VERSION);

        const processesPromise = all
            ? Process.find(query)
                .select(projection)
                .sort({ updatedAt: -1 })
                .lean()
            : Process.find(query)
                .select(projection)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

        const [processes, total, activeRuleSetVersion] = await Promise.all([
            processesPromise,
            Process.countDocuments(query),
            getActiveRuleSetVersion(),
        ]);

        const processIds = processes.map((p: any) => p?._id).filter(Boolean);

        // Lectura principal desde materializado (sin calculo en vivo).
        const metricsDocs = await ProcessMetrics.find({
            processId: { $in: processIds },
            ruleSetVersion: activeRuleSetVersion ?? KPI_RULE_SET_VERSION_V1,
        }).lean();

        const metricsByProcessId = new Map<string, any>();
        for (const doc of metricsDocs) {
            metricsByProcessId.set(String(doc.processId), doc);
        }

        const enriched = processes.map((p) => {
            const materialized = metricsByProcessId.get(String((p as any)._id));
            const metricasTransito = !materialized
                ? {
                    status: "pending",
                    stale: true,
                    ruleSetVersion: activeRuleSetVersion ?? KPI_RULE_SET_VERSION_V1,
                    calculatedAt: null,
                    lastError: null,
                    summary: null,
                    kpis: {},
                }
                : {
                    status: materialized.status,
                    stale:
                        materialized.status === "stale" ||
                        materialized.status === "calculating",
                    ruleSetVersion:
                        materialized.ruleSetVersion ??
                        activeRuleSetVersion ??
                        KPI_RULE_SET_VERSION_V1,
                    calculatedAt: materialized.calculatedAt ?? null,
                    lastError:
                        materialized.status === "error"
                            ? materialized.lastError ?? null
                            : null,
                    summary: materialized.summary ?? null,
                    kpis: kpisArrayToMap(materialized.kpis),
                };

            const demorraje = (metricasTransito as any)?.kpis?.DEMORRAJE;
            const cumplimientoDemorraje = !demorraje
                ? {
                    estandar: null,
                    valorReal: null,
                    cumple: null,
                    estado: null,
                    diferencia: null,
                }
                : {
                    estandar: typeof demorraje?.slaTarget === "number" ? demorraje.slaTarget : null,
                    valorReal: typeof demorraje?.actualValue === "number" ? demorraje.actualValue : null,
                    cumple:
                        demorraje?.result === "success"
                            ? true
                            : demorraje?.result === "fail"
                            ? false
                            : null,
                    estado:
                        demorraje?.result === "success"
                            ? "CUMPLE"
                            : demorraje?.result === "fail"
                            ? "NO_CUMPLE"
                            : null,
                    diferencia: typeof demorraje?.delta === "number" ? demorraje.delta : null,
                };
            return {
                ...p,
                metricasTransito: {
                    ...metricasTransito,
                    cumplimientoDemorraje,
                },
            };
        });

        res.json({
            data: enriched,
            page,
            limit: all ? total : limit,
            total,
            totalPages: all ? 1 : Math.ceil(total / limit),
            ruleSetVersion: activeRuleSetVersion ?? KPI_RULE_SET_VERSION_V1,
            contractVersion: METRICS_API_CONTRACT_VERSION,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching processes" });
    }
};
// Obtener un proceso por ID
export const getProcessById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid process id" });
        }
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

        // `automatico` se considera campo de sistema (solo lectura).
        const stageNames = ["inicio", "preembarque", "postembarque", "aduana", "despacho"] as const;

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
                        if (stage === "despacho" && key === "cantidadContenedores" && typeof value === "string") {
                            const parsedValue = Number(value.trim());
                            (proc as any)[stage][key] = Number.isFinite(parsedValue)
                                ? parsedValue
                                : null;
                            continue;
                        }
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
        // Fase 1: marcar materializado como stale luego de mutar el proceso.
        await markProcessMetricsStaleNoFail(proc, "updateProcess");
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
        // Fase 4: limpieza best-effort para evitar huérfanos en materializado.
        try {
            await ProcessMetrics.deleteMany({ processId: process._id });
        } catch (cleanupError) {
            console.error(
                "Error limpiando process_metrics tras deleteProcess:",
                cleanupError
            );
        }
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
        // Fase 1: marcar materializado como stale luego de mutar el proceso.
        await markProcessMetricsStaleNoFail(process, "anularProcess");
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
        // Fase 1: al eliminar item también se invalida materializado de KPIs.
        await markProcessMetricsStaleNoFail(process, "deleteItem");

        res.json(process);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deleting item" });
    }
};




