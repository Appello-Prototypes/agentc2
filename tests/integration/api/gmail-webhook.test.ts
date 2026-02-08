import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
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

describe("Gmail Webhook", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN = "test-token";
    });

    it("rejects missing Pub/Sub payload", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/gmail/webhook/route");
        const request = createMockRequest("/api/gmail/webhook?token=test-token", {
            method: "POST",
            body: {}
        });

        const response = await POST(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(400);
        expect(result.data.success).toBe(false);
    });
});
