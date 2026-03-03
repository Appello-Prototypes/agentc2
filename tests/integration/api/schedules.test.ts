import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, createMockParams, parseResponse } from "../../utils/api-helpers";
import { mockAgent } from "../../fixtures/agents";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    }
}));

const mockAuthenticateRequest = vi.fn();
vi.mock("@/lib/api-auth", () => ({
    authenticateRequest: (...args: unknown[]) => mockAuthenticateRequest(...args)
}));

describe("Schedules API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        mockAuthenticateRequest.mockReset();
        mockAuthenticateRequest.mockResolvedValue({
            userId: "user-1",
            organizationId: "org-1"
        });
        vi.clearAllMocks();
    });

    it("creates a schedule with valid input", async () => {
        const { POST: createSchedule } =
            await import("../../../apps/agent/src/app/api/agents/[id]/schedules/route");
        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.agent.findUnique.mockResolvedValue({
            workspaceId: "workspace-1"
        } as never);
        prismaMock.agentSchedule.create.mockResolvedValue({
            id: "schedule-1",
            name: "Daily Run",
            description: null,
            cronExpr: "0 9 * * *",
            timezone: "UTC",
            inputJson: null,
            isActive: true,
            nextRunAt: new Date(),
            createdAt: new Date()
        } as never);

        const request = createMockRequest("/api/agents/test-agent/schedules", {
            method: "POST",
            body: {
                name: "Daily Run",
                cronExpr: "0 9 * * *",
                timezone: "UTC"
            }
        });

        const response = await createSchedule(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(prismaMock.agentSchedule.create).toHaveBeenCalled();
    });

    it("returns 400 for missing cronExpr", async () => {
        const { POST: createSchedule } =
            await import("../../../apps/agent/src/app/api/agents/[id]/schedules/route");
        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        const request = createMockRequest("/api/agents/test-agent/schedules", {
            method: "POST",
            body: { name: "Daily Run" }
        });

        const response = await createSchedule(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(400);
    });

    it("previews schedule run times", async () => {
        const { POST: previewSchedule } =
            await import("../../../apps/agent/src/app/api/agents/[id]/schedules/preview/route");
        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        const request = createMockRequest("/api/agents/test-agent/schedules/preview", {
            method: "POST",
            body: { cronExpr: "*/5 * * * *", timezone: "UTC", count: 2 }
        });

        const response = await previewSchedule(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(Array.isArray(result.data.preview)).toBe(true);
        expect(result.data.preview).toHaveLength(2);
    });
});
