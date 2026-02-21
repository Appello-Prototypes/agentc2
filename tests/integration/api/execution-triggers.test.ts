import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, createMockParams, parseResponse } from "../../utils/api-helpers";
import { mockAgent } from "../../fixtures/agents";

const prismaMock = mockDeep<PrismaClient>();
const requireAuthMock = vi.fn();
const requireAgentAccessMock = vi.fn();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    }
}));

vi.mock("@/lib/authz", () => ({
    requireAuth: requireAuthMock,
    requireAgentAccess: requireAgentAccessMock
}));

vi.mock("@/lib/credential-crypto", () => ({
    encryptString: vi.fn((s: string) => `encrypted:${s}`)
}));

describe("Execution Triggers API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        requireAuthMock.mockResolvedValue({
            context: { userId: "user-1", organizationId: "org-1" }
        });
        requireAgentAccessMock.mockResolvedValue({
            agentId: mockAgent.id
        });
        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
    });

    it("creates a scheduled trigger", async () => {
        const { POST: createExecutionTrigger } =
            await import("../../../apps/agent/src/app/api/agents/[id]/execution-triggers/route");
        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.agentSchedule.create.mockResolvedValue({
            id: "schedule-1",
            name: "Daily",
            description: null,
            cronExpr: "0 9 * * *",
            timezone: "UTC",
            inputJson: null,
            isActive: true,
            lastRunAt: null,
            nextRunAt: new Date(),
            runCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        } as never);

        const request = createMockRequest("/api/agents/test-agent/execution-triggers", {
            method: "POST",
            body: {
                type: "scheduled",
                name: "Daily",
                config: { cronExpr: "0 9 * * *", timezone: "UTC" }
            }
        });

        const response = await createExecutionTrigger(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(prismaMock.agentSchedule.create).toHaveBeenCalled();
    });

    it.each([
        ["webhook", {}],
        ["event", { eventName: "orders.created" }],
        ["mcp", {}],
        ["api", {}],
        ["manual", {}],
        ["test", {}]
    ])("creates a %s trigger", async (triggerType, config) => {
        const { POST: createExecutionTrigger } =
            await import("../../../apps/agent/src/app/api/agents/[id]/execution-triggers/route");
        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.agentTrigger.create.mockResolvedValue({
            id: "trigger-1",
            name: "Trigger",
            description: null,
            triggerType,
            eventName: triggerType === "event" ? "orders.created" : null,
            webhookPath: triggerType === "webhook" ? "trigger_123" : null,
            webhookSecret: triggerType === "webhook" ? "secret" : null,
            filterJson: null,
            inputMapping: null,
            isActive: true,
            lastTriggeredAt: null,
            triggerCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        } as never);

        const request = createMockRequest("/api/agents/test-agent/execution-triggers", {
            method: "POST",
            body: {
                type: triggerType,
                name: "Trigger",
                config
            }
        });

        const response = await createExecutionTrigger(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(prismaMock.agentTrigger.create).toHaveBeenCalled();
    });
});
