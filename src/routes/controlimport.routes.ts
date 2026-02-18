import { Router } from "express";
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
import { auth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

router.get("/", getProcesses);
/* =========================
   RUTAS PROTEGIDAS
========================= */
router.use(auth); // 🔒 Todas las rutas requieren login

/* =========================
   CREAR Y LISTAR
========================= */
router.post("/", createProcess);

/* =========================
   UTILIDADES (ANTES DE /:id)
========================= */
router.get("/preview/codigo", previewCodigo); // 🐛 Fix: Antes de /:id

/* =========================
   CRUD POR ID
========================= */
router.get("/:id", getProcessById);
router.put("/:id", updateProcess);
router.delete("/:id", requireRole("admin"), deleteProcess); // 🔒 Solo admin

// Ruta para anular proceso
router.put("/:id/anular", anularProcess);

router.delete("/:id/items/:codigo", deleteItem);


/* =========================
   ACTUALIZAR ETAPA
========================= */
router.patch("/:id/:stage", updateStage);

export default router;
