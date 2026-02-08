import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import {
    createMockParams,
    createMockRequest,
    parseResponse,
    assertSuccess
} from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        DbNull: "DbNull"
    },
    RunEnvironment: {
        DEVELOPMENT: "DEVELOPMENT",
        STAGING: "STAGING",
        PRODUCTION: "PRODUCTION"
    },
    RunTriggerType: {
        API: "API",
        MANUAL: "MANUAL",
        SCHEDULED: "SCHEDULED",
        WEBHOOK: "WEBHOOK",
        TOOL: "TOOL",
        TEST: "TEST",
        RETRY: "RETRY"
    }
}));

describe("Networks API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("should list networks with primitive counts", async () => {
        const { GET: listNetworks } =
            await import("../../../apps/agent/src/app/api/networks/route");
        prismaMock.network.findMany.mockResolvedValue([
            {
                id: "net-1",
                slug: "test-network",
                name: "Test Network",
                description: null,
                version: 1,
                isPublished: false,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { runs: 1, primitives: 3 }
            }
        ] as never);

        const response = await listNetworks();
        const data = await response.json();

        expect(prismaMock.network.findMany).toHaveBeenCalled();
        expect(data.success).toBe(true);
        expect(data.networks[0].primitiveCount).toBe(3);
    });

    it("should apply filters when listing network runs", async () => {
        const { GET: listRuns } =
            await import("../../../apps/agent/src/app/api/networks/[slug]/runs/route");
        prismaMock.network.findFirst.mockResolvedValue({
            id: "net-1"
        } as never);
        prismaMock.networkRun.findMany.mockResolvedValue([
            {
                id: "run-1",
                status: "COMPLETED",
                inputText: "hello",
                outputText: "world",
                outputJson: null,
                startedAt: new Date(),
                completedAt: new Date(),
                durationMs: 400,
                environment: "STAGING",
                triggerType: "WEBHOOK",
                _count: { steps: 3 }
            }
        ] as never);

        const request = createMockRequest("/api/networks/sample/runs", {
            searchParams: {
                status: "COMPLETED",
                environment: "staging",
                triggerType: "webhook",
                from: "2026-02-01T00:00:00.000Z",
                to: "2026-02-02T00:00:00.000Z",
                search: "run-1"
            }
        });
        const response = await listRuns(request, { params: createMockParams({ slug: "sample" }) });
        const parsed = await parseResponse(response);

        assertSuccess(parsed);
        expect(prismaMock.networkRun.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    networkId: "net-1",
                    status: "COMPLETED",
                    environment: "STAGING",
                    triggerType: "WEBHOOK",
                    startedAt: expect.objectContaining({
                        gte: expect.any(Date),
                        lte: expect.any(Date)
                    }),
                    OR: [
                        { id: { contains: "run-1", mode: "insensitive" } },
                        { inputText: { contains: "run-1", mode: "insensitive" } },
                        { outputText: { contains: "run-1", mode: "insensitive" } }
                    ]
                })
            })
        );
        expect(parsed.data.runs[0].triggerType).toBe("WEBHOOK");
    });
});
