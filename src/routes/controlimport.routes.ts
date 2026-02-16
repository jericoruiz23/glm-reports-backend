import { Router } from "express";
import multer from "multer";
import {
   createProcess,
   getProcesses,
   getProcessById,
   updateStage,
   updateProcess,
   deleteProcess,
   previewCodigo,
   anularProcess,
   deleteItem
} from "../controllers/controlimport.controller";

import { ingestProcessExcel } from "../controllers/processIngest.controller";

const router = Router();

/* =========================
   MULTER CONFIG
========================= */
const upload = multer({
   storage: multer.memoryStorage(),
   limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
   }
});

/* =========================
   INGESTA MASIVA EXCEL
   ⚠️ Debe ir ANTES de /:id
========================= */
router.post(
   "/ingest/excel",
   upload.single("file"),
   ingestProcessExcel
);

/* =========================
   CREAR Y LISTAR
========================= */
router.post("/", createProcess);
router.get("/", getProcesses);

/* =========================
   CRUD POR ID
========================= */
router.get("/:id", getProcessById);
router.put("/:id", updateProcess);
router.delete("/:id", deleteProcess);
router.get("/preview/codigo", previewCodigo);

// Ruta para anular proceso
router.put("/:id/anular", anularProcess);

router.delete("/:id/items/:codigo", deleteItem);


/* =========================
   ACTUALIZAR ETAPA
========================= */
router.patch("/:id/:stage", updateStage);

export default router;
