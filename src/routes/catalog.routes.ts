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
import { get } from "http";

const router = Router();

/**
 * Obtener TODOS los catálogos
 * GET /api/catalogos
 */
router.get("/", getCatalogos);
router.get("/list", getCatalogosList);
router.get("/:catalogId", getCatalogById);
/**
 * Obtener un catálogo específico por tipo
 * GET /api/catalogos/:tipo
 */
router.get("/:tipo", getCatalogByTipo);

/**
 * Crear un nuevo tipo de catálogo
 * POST /api/catalogos
 */
router.post("/", createCatalog);

/**
 * Agregar un valor a un catálogo
 * POST /api/catalogos/:tipo/valor
 */
router.post("/:catalogId/valor", addCatalogValue);


/**
 * Desactivar (soft delete) un valor del catálogo
 * PATCH /api/catalogos/:tipo/valor/:key
 */
router.delete("/:tipo/valor/:key", deleteCatalogValue);

export default router;
