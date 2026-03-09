import { Router } from "express";
import {
    getCatalogos,
    getCatalogByTipo,
    createCatalog,
    addCatalogValue,
    deleteCatalogValue,
    getCatalogosList,
    getCatalogById
} from "../controllers/catalog.controller";
import { auth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

router.get("/", getCatalogos);
router.get("/list", getCatalogosList);

router.get("/:catalogId", getCatalogById);
router.get("/type/:tipo", getCatalogByTipo);

router.post("/", auth, requireRole("admin"), createCatalog);
router.post("/:catalogId/valor", auth, requireRole("admin"), addCatalogValue);
router.delete("/:tipo/valor/:key", auth, requireRole("admin"), deleteCatalogValue);

export default router;
