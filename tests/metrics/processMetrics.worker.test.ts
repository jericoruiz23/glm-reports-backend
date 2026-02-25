import { describe, expect, it, vi } from "vitest";

const {
    findOneAndUpdateMock,
    countDocumentsMock,
    findOneMock,
    findMock,
    updateManyMock,
    processFindByIdMock,
} = vi.hoisted(() => ({
    findOneAndUpdateMock: vi.fn(),
    countDocumentsMock: vi.fn(),
    findOneMock: vi.fn(),
    findMock: vi.fn(),
    updateManyMock: vi.fn(),
    processFindByIdMock: vi.fn(),
}));

vi.mock("../../src/models/processMetrics.model", () => ({
    default: {
        findOneAndUpdate: findOneAndUpdateMock,
        countDocuments: countDocumentsMock,
        findOne: findOneMock,
        find: findMock,
        updateMany: updateManyMock,
    },
}));

vi.mock("../../src/models/controlimport.model", () => ({
    Process: {
        findById: processFindByIdMock,
    },
}));

vi.mock("../../src/metrics/processMetrics.compute", () => ({
    computeProcessMetrics: vi.fn(() => ({
        ruleSetVersion: "2026.02.v1",
        kpis: [],
        summary: {
            total: 0,
            success: 0,
            fail: 0,
            pending: 0,
            na: 0,
            score: null,
        },
    })),
}));

vi.mock("../../src/metrics/processFingerprint", () => ({
    buildProcessFingerprint: vi.fn(() => "same-fingerprint"),
}));

import { runOneMetricsJob } from "../../src/metrics/processMetrics.worker";

describe("runOneMetricsJob", () => {
    it("moves stale claim to fresh when compute succeeds", async () => {
        findOneAndUpdateMock
            .mockReturnValueOnce({
                lean: async () => ({
                    _id: "m1",
                    processId: "p1",
                    processFingerprint: "same-fingerprint",
                    ruleSetVersion: "2026.02.v1",
                    status: "calculating",
                }),
            })
            .mockResolvedValueOnce({});

        processFindByIdMock.mockReturnValueOnce({
            lean: async () => ({
                _id: "p1",
                proceso: "IMPORT",
            }),
        });

        const result = await runOneMetricsJob();
        expect(result.status).toBe("fresh");
        expect(result.processId).toBe("p1");
    });
});
