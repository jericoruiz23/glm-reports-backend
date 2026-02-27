import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const {
    findOneMock,
    findMock,
    countDocumentsMock,
    findByIdMock,
    aggregateMock,
    markStaleMock,
    runForProcessMock,
} = vi.hoisted(() => ({
    findOneMock: vi.fn(),
    findMock: vi.fn(),
    countDocumentsMock: vi.fn(),
    findByIdMock: vi.fn(),
    aggregateMock: vi.fn(),
    markStaleMock: vi.fn(),
    runForProcessMock: vi.fn(),
}));

vi.mock("../../src/models/processMetrics.model", () => ({
    default: {
        findOne: findOneMock,
        find: findMock,
        countDocuments: countDocumentsMock,
    },
}));

vi.mock("../../src/models/controlimport.model", () => ({
    Process: {
        findById: findByIdMock,
        aggregate: aggregateMock,
    },
}));

vi.mock("../../src/metrics/processMetrics.service", () => ({
    markProcessMetricsStale: markStaleMock,
}));

vi.mock("../../src/metrics/processMetrics.worker", () => ({
    runMetricsJobForProcessId: runForProcessMock,
    getProcessMetricsQueueHealth: vi.fn(async () => ({
        staleCount: 0,
        calculatingCount: 0,
        freshCount: 1,
        errorCount: 0,
        freshRate: 100,
        minutesSinceLastCalculatedAt: 1,
        lastCalculatedAt: new Date(),
        maxFreshAgeMinutes: 1,
    })),
    requeueErrorMetricsForRetry: vi.fn(async () => 0),
}));

vi.mock("../../src/metrics/ruleSet.service", () => ({
    getActiveRuleSetVersion: vi.fn(async () => "2026.02.v1"),
    activateRuleSetVersion: vi.fn(),
    deactivateRuleSetVersion: vi.fn(),
    listRuleSets: vi.fn(async () => []),
    upsertRuleSetVersion: vi.fn(),
}));

vi.mock("../../src/metrics/metricsAudit.service", () => ({
    auditMetricsAction: vi.fn(async () => undefined),
}));

import {
    getProcessMetricsByProcessId,
    getProcessMetrics,
    recalculateProcessMetrics,
} from "../../src/controllers/processMetrics.controller";

const createRes = () => {
    const res = {} as Response;
    (res.status as any) = vi.fn(() => res);
    (res.json as any) = vi.fn(() => res);
    (res.setHeader as any) = vi.fn(() => res);
    return res;
};

describe("processMetrics.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 404 when materialized metrics do not exist", async () => {
        findOneMock.mockReturnValueOnce({ lean: async () => null });
        const req = { params: { id: "507f1f77bcf86cd799439011" } } as unknown as Request;
        const res = createRes();
        await getProcessMetricsByProcessId(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it("adds globalKpis.TOTAL_CONTENEDORES_GLOBAL to list response", async () => {
        findMock.mockReturnValueOnce({
            sort: () => ({
                lean: async () => [],
            }),
        });
        countDocumentsMock.mockResolvedValueOnce(0);
        aggregateMock.mockResolvedValueOnce([{ _id: null, total: 27 }]);

        const req = { query: {} } as unknown as Request;
        const res = createRes();
        await getProcessMetrics(req, res);

        expect(aggregateMock).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                globalKpis: {
                    TOTAL_CONTENEDORES_GLOBAL: {
                        result: "success",
                        slaTarget: null,
                        actualValue: 27,
                        delta: null,
                        meta: { scope: "global" },
                    },
                },
                data: [],
            })
        );
    });

    it("defaults TOTAL_CONTENEDORES_GLOBAL to 0 when aggregate has no rows", async () => {
        findMock.mockReturnValueOnce({
            sort: () => ({
                lean: async () => [],
            }),
        });
        countDocumentsMock.mockResolvedValueOnce(0);
        aggregateMock.mockResolvedValueOnce([]);

        const req = { query: {} } as unknown as Request;
        const res = createRes();
        await getProcessMetrics(req, res);

        const payload = (res.json as any).mock.calls[0][0];
        expect(payload.globalKpis.TOTAL_CONTENEDORES_GLOBAL.actualValue).toBe(0);
    });

    it("recalculate with runNow executes targeted worker", async () => {
        findByIdMock.mockResolvedValueOnce({ _id: "507f1f77bcf86cd799439011" });
        markStaleMock.mockResolvedValueOnce("2026.02.v1");
        runForProcessMock.mockResolvedValueOnce({
            processed: true,
            status: "fresh",
            processId: "507f1f77bcf86cd799439011",
        });

        const req = {
            params: { id: "507f1f77bcf86cd799439011" },
            query: { runNow: "true" },
            body: {},
        } as unknown as Request;
        const res = createRes();
        await recalculateProcessMetrics(req, res);

        expect(runForProcessMock).toHaveBeenCalledWith(
            "507f1f77bcf86cd799439011",
            "2026.02.v1"
        );
    });
});
