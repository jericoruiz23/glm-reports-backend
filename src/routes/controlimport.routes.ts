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

router.use(auth);

router.post("/", createProcess);

router.get("/preview/codigo", previewCodigo);

router.get("/:id", getProcessById);
router.put("/:id", updateProcess);
router.delete("/:id", requireRole("admin"), deleteProcess);

router.put("/:id/anular", anularProcess);

router.delete("/:id/items/:codigo", deleteItem);

router.patch("/:id/:stage", updateStage);

export default router;
