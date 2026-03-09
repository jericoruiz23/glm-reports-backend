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

router.get("/metrics", getProcessMetrics);

router.use("/metrics", auth);

router.get("/metrics/health", requireRole("admin"), getProcessMetricsHealth);

router.get("/metrics/legacy-usage", requireRole("admin"), getLegacyUsage);

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

router.get("/:id/metrics", auth, getProcessMetricsByProcessId);

router.post(
    "/:id/metrics/recalculate",
    auth,
    requireRole("admin"),
    simpleRateLimit(30, 60_000),
    recalculateProcessMetrics
);

router.post(
    "/metrics/recalculate-by-filter",
    requireRole("admin"),
    simpleRateLimit(5, 60_000),
    recalculateProcessMetricsByFilter
);

router.post(
    "/metrics/retry-errors",
    requireRole("admin"),
    simpleRateLimit(10, 60_000),
    retryErroredProcessMetrics
);

export default router;
