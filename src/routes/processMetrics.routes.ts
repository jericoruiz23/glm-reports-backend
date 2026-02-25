import { Router } from "express";
import {
    activateRuleSet,
    deactivateRuleSet,
    getProcessMetrics,
    getProcessMetricsHealth,
    getProcessMetricsByProcessId,
    getLegacyUsage,
    getRuleSets,
    recalculateProcessMetricsByFilter,
    recalculateProcessMetrics,
    retryErroredProcessMetrics,
    upsertRuleSet,
} from "../controllers/processMetrics.controller";
import { auth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { simpleRateLimit } from "../middlewares/simpleRateLimit.middleware";

const router = Router();

// Todas las rutas de métricas requieren autenticación.
router.use(auth);

// Salud operativa de la cola/materializado (solo admin).
router.get("/metrics/health", requireRole("admin"), getProcessMetricsHealth);
// Listado de documentos materializados (solo admin).
router.get("/metrics", requireRole("admin"), getProcessMetrics);
// Métrica de adopción legacy=true (solo admin).
router.get("/metrics/legacy-usage", requireRole("admin"), getLegacyUsage);

// Gobernanza de rule sets (admin).
router.get("/metrics/rule-sets", requireRole("admin"), getRuleSets);
router.post("/metrics/rule-sets", requireRole("admin"), upsertRuleSet);
router.post(
    "/metrics/rule-sets/:version/activate",
    requireRole("admin"),
    activateRuleSet
);
router.post(
    "/metrics/rule-sets/:version/deactivate",
    requireRole("admin"),
    deactivateRuleSet
);

// Lectura de materializado por processId.
router.get("/:id/metrics", getProcessMetricsByProcessId);

// Recalculo manual: restringido a admin.
router.post(
    "/:id/metrics/recalculate",
    requireRole("admin"),
    simpleRateLimit(30, 60_000),
    recalculateProcessMetrics
);

// Reproceso masivo opcional por filtro operativo (admin).
router.post(
    "/metrics/recalculate-by-filter",
    requireRole("admin"),
    simpleRateLimit(5, 60_000),
    recalculateProcessMetricsByFilter
);

// Retry controlado para documentos en error (admin).
router.post(
    "/metrics/retry-errors",
    requireRole("admin"),
    simpleRateLimit(10, 60_000),
    retryErroredProcessMetrics
);

export default router;
