import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";
import { createMockParams, createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const checkRateLimitMock = vi.fn();
const buildTriggerPayloadSnapshotMock = vi.fn();
const createTriggerEventRecordMock = vi.fn();
const updateTriggerEventRecordMock = vi.fn();
const inngestSendMock = vi.fn();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    TriggerEventStatus: {
        RECEIVED: "RECEIVED",
        SKIPPED: "SKIPPED",
        REJECTED: "REJECTED"
    }
}));

vi.mock("@/lib/rate-limit", () => ({
    checkRateLimit: checkRateLimitMock
}));

vi.mock("@/lib/trigger-events", () => ({
    buildTriggerPayloadSnapshot: buildTriggerPayloadSnapshotMock,
    createTriggerEventRecord: createTriggerEventRecordMock,
    updateTriggerEventRecord: updateTriggerEventRecordMock
}));

vi.mock("@/lib/inngest", () => ({
    inngest: {
        send: inngestSendMock
    }
}));

const signPayload = (payload: string, secret: string, timestamp?: string) => {
    const signed = timestamp ? `${timestamp}.${payload}` : payload;
    return createHmac("sha256", secret).update(signed).digest("hex");
};

describe("Webhook execution API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        checkRateLimitMock.mockReturnValue({ allowed: true });
        buildTriggerPayloadSnapshotMock.mockReturnValue({ normalizedPayload: { test: true } });
        createTriggerEventRecordMock.mockResolvedValue({ id: "event-1" });
    });

    it("returns 404 when webhook path is unknown", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/[path]/route");
        prismaMock.agentTrigger.findUnique.mockResolvedValue(null);

        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/unknown", { method: "POST" }),
            { params: createMockParams({ path: "unknown" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(404);
    });

    it("returns 429 when rate limited", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/[path]/route");
        prismaMock.agentTrigger.findUnique.mockResolvedValue({
            id: "trigger-1",
            webhookPath: "abc",
            isActive: true,
            triggerType: "webhook",
            webhookSecret: null,
            agent: { id: "agent-1", slug: "agent", name: "Agent", isActive: true },
            workspaceId: "workspace-1"
        } as never);
        checkRateLimitMock.mockReturnValue({ allowed: false });

        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/abc", { method: "POST" }),
            { params: createMockParams({ path: "abc" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(429);
        expect(createTriggerEventRecordMock).not.toHaveBeenCalled();
    });

    it("returns 403 when trigger is disabled", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/[path]/route");
        prismaMock.agentTrigger.findUnique.mockResolvedValue({
            id: "trigger-1",
            webhookPath: "abc",
            isActive: false,
            triggerType: "webhook",
            webhookSecret: null,
            agent: { id: "agent-1", slug: "agent", name: "Agent", isActive: true },
            workspaceId: "workspace-1"
        } as never);

        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/abc", { method: "POST" }),
            { params: createMockParams({ path: "abc" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(403);
        expect(updateTriggerEventRecordMock).toHaveBeenCalled();
    });

    it("returns 403 when agent is disabled", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/[path]/route");
        prismaMock.agentTrigger.findUnique.mockResolvedValue({
            id: "trigger-1",
            webhookPath: "abc",
            isActive: true,
            triggerType: "webhook",
            webhookSecret: null,
            agent: { id: "agent-1", slug: "agent", name: "Agent", isActive: false },
            workspaceId: "workspace-1"
        } as never);

        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/abc", { method: "POST" }),
            { params: createMockParams({ path: "abc" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(403);
        expect(updateTriggerEventRecordMock).toHaveBeenCalled();
    });

    it("returns 401 for invalid signature", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/[path]/route");
        prismaMock.agentTrigger.findUnique.mockResolvedValue({
            id: "trigger-1",
            webhookPath: "abc",
            isActive: true,
            triggerType: "webhook",
            webhookSecret: "secret",
            agent: { id: "agent-1", slug: "agent", name: "Agent", isActive: true },
            workspaceId: "workspace-1"
        } as never);

        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/abc", {
                method: "POST",
                headers: { "x-webhook-signature": "bad" },
                body: { test: true }
            }),
            { params: createMockParams({ path: "abc" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(401);
        expect(updateTriggerEventRecordMock).toHaveBeenCalled();
    });

    it("returns 401 for expired timestamp", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/[path]/route");
        prismaMock.agentTrigger.findUnique.mockResolvedValue({
            id: "trigger-1",
            webhookPath: "abc",
            isActive: true,
            triggerType: "webhook",
            webhookSecret: "secret",
            agent: { id: "agent-1", slug: "agent", name: "Agent", isActive: true },
            workspaceId: "workspace-1"
        } as never);

        const payload = JSON.stringify({ test: true });
        const oldTimestamp = String(Math.floor(Date.now() / 1000) - 60 * 10);
        const signature = signPayload(payload, "secret", oldTimestamp);

        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/abc", {
                method: "POST",
                headers: {
                    "x-webhook-signature": signature,
                    "x-webhook-timestamp": oldTimestamp
                },
                body: { test: true }
            }),
            { params: createMockParams({ path: "abc" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(401);
        expect(updateTriggerEventRecordMock).toHaveBeenCalled();
    });

    it("sends inngest event on successful webhook", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/webhooks/[path]/route");
        prismaMock.agentTrigger.findUnique.mockResolvedValue({
            id: "trigger-1",
            name: "Webhook",
            webhookPath: "abc",
            isActive: true,
            triggerType: "webhook",
            webhookSecret: "secret",
            agent: { id: "agent-1", slug: "agent", name: "Agent", isActive: true },
            workspaceId: "workspace-1"
        } as never);

        const payload = JSON.stringify({ test: true });
        const signature = signPayload(payload, "secret");

        const response = await POST(
            createMockRequest("http://localhost/api/webhooks/abc", {
                method: "POST",
                headers: {
                    "x-webhook-signature": signature
                },
                body: { test: true }
            }),
            { params: createMockParams({ path: "abc" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
        expect(result.data).toMatchObject({ success: true });
        expect(inngestSendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "agent/trigger.fire"
            })
        );
        expect(createTriggerEventRecordMock).toHaveBeenCalled();
    });
});
