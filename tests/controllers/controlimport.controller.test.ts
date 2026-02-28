import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const {
    processFindMock,
    processCountDocumentsMock,
    processMetricsFindMock,
} = vi.hoisted(() => ({
    processFindMock: vi.fn(),
    processCountDocumentsMock: vi.fn(),
    processMetricsFindMock: vi.fn(),
}));

vi.mock("../../src/models/controlimport.model", () => ({
    Process: {
        find: processFindMock,
        countDocuments: processCountDocumentsMock,
    },
    calcularEstado: vi.fn(),
}));

vi.mock("../../src/models/counter.model", () => ({
    Counter: {},
}));

vi.mock("../../src/metrics/processMetrics.service", () => ({
    markProcessMetricsStale: vi.fn(),
}));

vi.mock("../../src/models/processMetrics.model", () => ({
    default: {
        find: processMetricsFindMock,
        deleteMany: vi.fn(),
    },
}));

import { getProcesses } from "../../src/controllers/controlimport.controller";

const createRes = () => {
    const res = {} as Response;
    (res.status as any) = vi.fn(() => res);
    (res.json as any) = vi.fn(() => res);
    (res.setHeader as any) = vi.fn(() => res);
    return res;
};

describe("controlimport.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns operational process data without KPI enrichment", async () => {
        const processes = [
            {
                _id: "507f1f77bcf86cd799439011",
                proceso: "IMPORTACION",
                codigoImportacion: "IMP-ORD-2026-001",
                estado: "EN_CURSO",
                automatico: {
                    cumplimientoDemorraje: {
                        estado: "deprecated",
                    },
                },
            },
        ];

        processFindMock.mockReturnValueOnce({
            select: () => ({
                sort: () => ({
                    lean: async () => processes,
                }),
            }),
        });
        processCountDocumentsMock.mockResolvedValueOnce(processes.length);

        const req = { query: {} } as unknown as Request;
        const res = createRes();

        await getProcesses(req, res);

        expect(processMetricsFindMock).not.toHaveBeenCalled();
        const payload = (res.json as any).mock.calls[0][0];
        expect(payload).toEqual({
            data: [
                {
                    ...processes[0],
                    automatico: {},
                },
            ],
            page: 1,
            limit: 1,
            total: 1,
            totalPages: 1,
        });
        expect(payload.data[0]).not.toHaveProperty("metricasTransito");
        expect(payload.data[0].automatico).not.toHaveProperty("cumplimientoDemorraje");
        expect(payload).not.toHaveProperty("contractVersion");
        expect(payload).not.toHaveProperty("ruleSetVersion");
        expect(
            (res.setHeader as any).mock.calls.some(
                ([headerName]: [string]) => headerName === "X-Metrics-Contract-Version"
            )
        ).toBe(false);
    });
});
