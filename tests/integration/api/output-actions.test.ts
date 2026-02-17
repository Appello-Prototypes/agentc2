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

// Mock the output-actions dispatcher for test endpoint
vi.mock("../../../apps/agent/src/lib/output-actions", () => ({
    executeOutputAction: vi.fn().mockResolvedValue({ success: true })
}));

const mockOutputAction = {
    id: "action-1",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    name: "Test Webhook",
    type: "WEBHOOK",
    configJson: { url: "https://example.com/hook" },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null
};

describe("Output Actions API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    // Test 17: POST creates action
    it("POST creates action and returns it", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/agents/[id]/output-actions/route");

        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.outputAction.create.mockResolvedValue(mockOutputAction as never);

        const request = createMockRequest("/api/agents/test-agent/output-actions", {
            method: "POST",
            body: {
                name: "Test Webhook",
                type: "WEBHOOK",
                configJson: { url: "https://example.com/hook" }
            }
        });

        const response = await POST(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(prismaMock.outputAction.create).toHaveBeenCalled();
    });

    // Test 18: POST rejects missing required fields
    it("POST rejects missing required fields", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/agents/[id]/output-actions/route");

        const request = createMockRequest("/api/agents/test-agent/output-actions", {
            method: "POST",
            body: { name: "Missing type" }
        });

        const response = await POST(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(400);
        expect(result.data.success).toBe(false);
    });

    // Test 19: POST rejects invalid type
    it("POST rejects invalid type enum", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/agents/[id]/output-actions/route");

        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);

        const request = createMockRequest("/api/agents/test-agent/output-actions", {
            method: "POST",
            body: {
                name: "Bad Type",
                type: "SLACK_POST",
                configJson: { channelId: "C123" }
            }
        });

        const response = await POST(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(400);
        expect(result.data.error).toContain("Invalid type");
    });

    // Test 20: GET lists actions
    it("GET lists actions for agent", async () => {
        const { GET } =
            await import("../../../apps/agent/src/app/api/agents/[id]/output-actions/route");

        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.outputAction.findMany.mockResolvedValue([mockOutputAction] as never);

        const request = createMockRequest("/api/agents/test-agent/output-actions");

        const response = await GET(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse<{
            success: boolean;
            outputActions: unknown[];
            total: number;
        }>(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.outputActions).toHaveLength(1);
        expect(result.data.total).toBe(1);
    });

    // Test 21: PATCH updates isActive
    it("PATCH updates isActive", async () => {
        const { PATCH } =
            await import("../../../apps/agent/src/app/api/agents/[id]/output-actions/[actionId]/route");

        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.outputAction.findFirst.mockResolvedValue(mockOutputAction as never);
        prismaMock.outputAction.update.mockResolvedValue({
            ...mockOutputAction,
            isActive: false
        } as never);

        const request = createMockRequest("/api/agents/test-agent/output-actions/action-1", {
            method: "PATCH",
            body: { isActive: false }
        });

        const response = await PATCH(request, {
            params: createMockParams({ id: "test-agent", actionId: "action-1" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
    });

    // Test 22: DELETE removes action
    it("DELETE removes action", async () => {
        const { DELETE } =
            await import("../../../apps/agent/src/app/api/agents/[id]/output-actions/[actionId]/route");

        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.outputAction.findFirst.mockResolvedValue(mockOutputAction as never);
        prismaMock.outputAction.delete.mockResolvedValue(mockOutputAction as never);

        const request = createMockRequest("/api/agents/test-agent/output-actions/action-1", {
            method: "DELETE"
        });

        const response = await DELETE(request, {
            params: createMockParams({ id: "test-agent", actionId: "action-1" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
    });
});
