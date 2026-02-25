import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/metrics/kpi.builder", () => {
    return {
        construirMetricasTransito: vi.fn(() => ({
            kpis: {
                ETA_ENVIO: {
                    result: "success",
                    slaTarget: 2,
                    actualValue: 1,
                    delta: 0,
                    meta: {},
                },
                ETA_SALIDA: {
                    result: "fail",
                    slaTarget: 3,
                    actualValue: 5,
                    delta: 2,
                    meta: {},
                },
                ENTREGA_BODEGA: {
                    result: "pending",
                    slaTarget: 1,
                    actualValue: null,
                    delta: null,
                    meta: {},
                },
                DEMORRAJE: {
                    result: "na",
                    slaTarget: null,
                    actualValue: null,
                    delta: null,
                    meta: {},
                },
            },
        })),
    };
});

import { computeProcessMetrics } from "../../src/metrics/processMetrics.compute";

describe("computeProcessMetrics", () => {
    it("builds summary and preserves provided ruleSetVersion", () => {
        const out = computeProcessMetrics({} as any, "2026.99.v9");
        expect(out.ruleSetVersion).toBe("2026.99.v9");
        expect(out.kpis.length).toBe(4);
        expect(out.summary.total).toBe(4);
        expect(out.summary.success).toBe(1);
        expect(out.summary.fail).toBe(1);
        expect(out.summary.pending).toBe(1);
        expect(out.summary.na).toBe(1);
        expect(out.summary.score).toBe(50);
    });
});
