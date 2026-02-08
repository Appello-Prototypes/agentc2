import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const getSessionMock = vi.fn();
const getUserOrganizationIdMock = vi.fn();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

vi.mock("@repo/auth", () => ({
    auth: {
        api: {
            getSession: getSessionMock
        }
    }
}));

vi.mock("@/lib/organization", () => ({
    getUserOrganizationId: getUserOrganizationIdMock
}));

describe("Gmail Integration API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
        getUserOrganizationIdMock.mockResolvedValue("org-1");
    });

    it("rejects missing fields", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/integrations/gmail/route");
        const request = createMockRequest("/api/integrations/gmail", {
            method: "POST",
            body: {}
        });

        const response = await POST(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(400);
        expect(result.data.success).toBe(false);
    });

    it("creates integration when inputs are valid", async () => {
        const { POST } = await import("../../../apps/agent/src/app/api/integrations/gmail/route");
        prismaMock.agent.findFirst.mockResolvedValue({
            id: "agent-1",
            workspaceId: "workspace-1"
        } as never);
        prismaMock.integrationProvider.findUnique.mockResolvedValue({
            id: "provider-gmail"
        } as never);
        prismaMock.integrationConnection.findFirst.mockResolvedValue({
            id: "connection-1",
            credentials: { gmailAddress: "test@gmail.com" }
        } as never);
        prismaMock.gmailIntegration.upsert.mockResolvedValue({
            id: "integration-1",
            agentId: "agent-1",
            gmailAddress: "test@gmail.com",
            slackUserId: "U123",
            integrationConnectionId: "connection-1"
        } as never);
        prismaMock.agentTrigger.findFirst.mockResolvedValue(null);
        prismaMock.agentTrigger.create.mockResolvedValue({ id: "trigger-1" } as never);

        const request = createMockRequest("/api/integrations/gmail", {
            method: "POST",
            body: {
                agentId: "agent-1",
                gmailAddress: "test@gmail.com",
                slackUserId: "U123"
            }
        });

        const response = await POST(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
    });
});
