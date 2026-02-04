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
    }
}));

describe("Workflows API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("should list workflows with run counts", async () => {
        const { GET: listWorkflows } =
            await import("../../../apps/agent/src/app/api/workflows/route");
        prismaMock.workflow.findMany.mockResolvedValue([
            {
                id: "wf-1",
                slug: "test",
                name: "Test Workflow",
                description: null,
                version: 1,
                isPublished: false,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { runs: 2 }
            }
        ] as never);

        const response = await listWorkflows();
        const data = await response.json();

        expect(prismaMock.workflow.findMany).toHaveBeenCalled();
        expect(data.success).toBe(true);
        expect(data.workflows[0].runCount).toBe(2);
    });

    it("should apply filters when listing workflow runs", async () => {
        const { GET: listRuns } =
            await import("../../../apps/agent/src/app/api/workflows/[slug]/runs/route");
        prismaMock.workflow.findFirst.mockResolvedValue({
            id: "wf-1"
        } as never);
        prismaMock.workflowRun.findMany.mockResolvedValue([
            {
                id: "run-1",
                status: "COMPLETED",
                inputJson: { expression: "2 + 2" },
                outputJson: { result: 4 },
                startedAt: new Date(),
                completedAt: new Date(),
                suspendedAt: null,
                suspendedStep: null,
                durationMs: 500,
                environment: "PRODUCTION",
                triggerType: "API",
                _count: { steps: 2 }
            }
        ] as never);

        const request = createMockRequest("/api/workflows/sample/runs", {
            searchParams: {
                status: "COMPLETED",
                environment: "production",
                triggerType: "api",
                from: "2026-02-01T00:00:00.000Z",
                to: "2026-02-02T00:00:00.000Z",
                search: "run-1"
            }
        });
        const response = await listRuns(request, { params: createMockParams({ slug: "sample" }) });
        const parsed = await parseResponse(response);

        assertSuccess(parsed);
        expect(prismaMock.workflowRun.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    workflowId: "wf-1",
                    status: "COMPLETED",
                    environment: "PRODUCTION",
                    triggerType: "API",
                    startedAt: expect.objectContaining({
                        gte: expect.any(Date),
                        lte: expect.any(Date)
                    }),
                    OR: [
                        {
                            id: {
                                contains: "run-1",
                                mode: "insensitive"
                            }
                        }
                    ]
                })
            })
        );
        expect(parsed.data.success).toBe(true);
        expect(parsed.data.runs[0].environment).toBe("PRODUCTION");
    });
});
