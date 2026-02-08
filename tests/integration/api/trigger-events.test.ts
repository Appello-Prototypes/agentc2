import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();

const inngestMock = {
    send: vi.fn().mockResolvedValue({ ids: ["test-event-id"] })
};

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    },
    TriggerEventStatus: {
        RECEIVED: "RECEIVED",
        FILTERED: "FILTERED",
        QUEUED: "QUEUED",
        SKIPPED: "SKIPPED",
        REJECTED: "REJECTED",
        NO_MATCH: "NO_MATCH",
        ERROR: "ERROR"
    }
}));

vi.mock("@/lib/inngest", () => ({
    inngest: inngestMock
}));

describe("Trigger Event API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        process.env.MCP_API_KEY = "test-key";
    });

    it("logs a no-match event when no triggers are active", async () => {
        const { POST: fireEvent } =
            await import("../../../apps/agent/src/app/api/triggers/event/route");
        prismaMock.agentTrigger.findMany.mockResolvedValue([]);
        prismaMock.triggerEvent.create.mockResolvedValue({
            id: "event-1",
            status: "NO_MATCH",
            runId: null,
            payloadPreview: null,
            payloadTruncated: false
        } as never);

        const request = createMockRequest("/api/triggers/event", {
            method: "POST",
            headers: { "x-api-key": "test-key" },
            body: {
                eventName: "custom.event",
                payload: { hello: "world" },
                workspaceId: "workspace-1"
            }
        });

        const response = await fireEvent(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.triggered).toBe(0);
        expect(prismaMock.triggerEvent.create).toHaveBeenCalled();
        expect(inngestMock.send).not.toHaveBeenCalled();
    });

    it("creates trigger events and dispatches to inngest", async () => {
        const { POST: fireEvent } =
            await import("../../../apps/agent/src/app/api/triggers/event/route");
        prismaMock.agentTrigger.findMany.mockResolvedValue([
            {
                id: "trigger-1",
                name: "Test Trigger",
                triggerType: "event",
                eventName: "custom.event",
                workspaceId: "workspace-1",
                agent: {
                    id: "agent-1",
                    slug: "agent-1",
                    isActive: true
                }
            }
        ] as never);

        prismaMock.triggerEvent.create.mockResolvedValue({
            id: "event-1",
            status: "RECEIVED",
            runId: null,
            payloadPreview: null,
            payloadTruncated: false
        } as never);

        const request = createMockRequest("/api/triggers/event", {
            method: "POST",
            headers: { "x-api-key": "test-key" },
            body: {
                eventName: "custom.event",
                payload: { hello: "world" },
                workspaceId: "workspace-1"
            }
        });

        const response = await fireEvent(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.triggered).toBe(1);
        expect(prismaMock.triggerEvent.create).toHaveBeenCalled();
        expect(inngestMock.send).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "agent/trigger.fire",
                data: expect.objectContaining({
                    triggerId: "trigger-1",
                    agentId: "agent-1",
                    triggerEventId: "event-1"
                })
            })
        );
    });
});
