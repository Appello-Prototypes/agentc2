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

describe("Triggers API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    it("creates a webhook trigger", async () => {
        const { POST: createTrigger } =
            await import("../../../apps/agent/src/app/api/agents/[id]/triggers/route");
        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        prismaMock.agentTrigger.create.mockResolvedValue({
            id: "trigger-1",
            name: "Webhook Trigger",
            description: null,
            triggerType: "webhook",
            eventName: null,
            webhookPath: "trigger_123",
            webhookSecret: "secret",
            filterJson: null,
            inputMapping: null,
            isActive: true,
            createdAt: new Date()
        } as never);

        const request = createMockRequest("/api/agents/test-agent/triggers", {
            method: "POST",
            body: {
                name: "Webhook Trigger",
                triggerType: "webhook"
            }
        });

        const response = await createTrigger(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(prismaMock.agentTrigger.create).toHaveBeenCalled();
    });

    it("requires eventName for event triggers", async () => {
        const { POST: createTrigger } =
            await import("../../../apps/agent/src/app/api/agents/[id]/triggers/route");
        prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
        const request = createMockRequest("/api/agents/test-agent/triggers", {
            method: "POST",
            body: {
                name: "Event Trigger",
                triggerType: "event"
            }
        });

        const response = await createTrigger(request, {
            params: createMockParams({ id: "test-agent" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(400);
    });
});
