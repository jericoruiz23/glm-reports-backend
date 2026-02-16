import { Request, Response } from "express";
import { Process } from "../models/controlimport.model";
import { parseIngestExcel } from "../utils/ingestFormat";

/**
 * Ingesta masiva de procesos desde Excel
 * - Agrupa filas en procesos
 * - Maneja múltiples items por proceso
 * - Campos automáticos NO vienen del Excel
 */
export const ingestProcessExcel = async (req: Request, res: Response) => {
    try {
        // 1️⃣ Validar archivo
        if (!req.file) {
            return res.status(400).json({
                message: "Archivo Excel requerido"
            });
        }

        // 2️⃣ Validar tipo MIME
        const allowedMimes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel"
        ];

        if (!allowedMimes.includes(req.file.mimetype)) {
            return res.status(400).json({
                message: "Formato inválido. Solo se permite Excel (.xlsx)"
            });
        }

        // 3️⃣ Parsear Excel
        const { procesos, errores } = parseIngestExcel(req.file.buffer);

        // 4️⃣ Validaciones de negocio
        if (errores.length > 0) {
            return res.status(400).json({
                message: "Errores en el archivo Excel",
                errores
            });
        }

        if (!procesos.length) {
            return res.status(400).json({
                message: "El archivo no contiene procesos válidos"
            });
        }
        console.log("Procesos a insertar:", JSON.stringify(procesos, null, 2));

        // 5️⃣ Guardar en BD
        const inserted = await Process.insertMany(procesos, {
            ordered: true
        });

        // 6️⃣ Respuesta
        return res.status(201).json({
            ok: true,
            totalProcesos: inserted.length,
            ids: inserted.map(p => p._id)
        });

    } catch (error: any) {
        console.error("❌ Error ingestando Excel:", error.message);
        console.error(error);
        return res.status(500).json({
            message: error.message || "Error procesando archivo Excel"
        });
    }

};
