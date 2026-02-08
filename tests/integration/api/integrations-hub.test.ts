import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const getSessionMock = vi.fn();
const getUserOrganizationIdMock = vi.fn();
const getIntegrationProvidersMock = vi.fn();
const getMcpToolsMock = vi.fn();
const invalidateMcpCacheForOrgMock = vi.fn();
const invalidateMcpToolsCacheForOrgMock = vi.fn();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
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

vi.mock("@repo/mastra", () => ({
    getIntegrationProviders: getIntegrationProvidersMock,
    getMcpTools: getMcpToolsMock,
    invalidateMcpCacheForOrg: invalidateMcpCacheForOrgMock,
    invalidateMcpToolsCacheForOrg: invalidateMcpToolsCacheForOrgMock
}));

describe("Integrations Hub API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
        getUserOrganizationIdMock.mockResolvedValue("org-1");
        prismaMock.membership.findFirst.mockResolvedValue({ role: "admin" } as never);
        getMcpToolsMock.mockResolvedValue({});
    });

    it("lists providers with connection status", async () => {
        const { GET } =
            await import("../../../apps/agent/src/app/api/integrations/providers/route");

        getIntegrationProvidersMock.mockResolvedValue([
            {
                id: "provider-1",
                key: "hubspot",
                name: "HubSpot",
                description: null,
                category: "crm",
                authType: "apiKey",
                providerType: "mcp",
                configJson: { requiredFields: ["TOKEN"] },
                actionsJson: null,
                triggersJson: null
            }
        ]);

        prismaMock.integrationConnection.findMany.mockResolvedValue([
            {
                id: "conn-1",
                providerId: "provider-1",
                name: "HubSpot Default",
                scope: "org",
                isDefault: true,
                isActive: true,
                credentials: { TOKEN: "abc" },
                provider: {
                    id: "provider-1",
                    key: "hubspot",
                    name: "HubSpot",
                    category: "crm",
                    authType: "apiKey",
                    providerType: "mcp"
                }
            }
        ] as never);

        const request = createMockRequest("/api/integrations/providers");
        const response = await GET(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.providers).toHaveLength(1);
        expect(result.data.providers[0].status).toBe("connected");
    });

    it("creates a connection for a provider", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/route");

        getIntegrationProvidersMock.mockResolvedValue([]);
        prismaMock.integrationProvider.findUnique.mockResolvedValue({
            id: "provider-1",
            key: "hubspot"
        } as never);
        prismaMock.integrationConnection.create.mockResolvedValue({
            id: "conn-1",
            name: "HubSpot Default"
        } as never);

        const request = createMockRequest("/api/integrations/connections", {
            method: "POST",
            body: {
                providerKey: "hubspot",
                name: "HubSpot Default",
                credentials: { TOKEN: "abc" }
            }
        });

        const response = await POST(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(prismaMock.integrationConnection.create).toHaveBeenCalled();
    });

    it("creates webhook connections", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/webhooks/route");

        getIntegrationProvidersMock.mockResolvedValue([]);
        prismaMock.integrationProvider.findUnique.mockResolvedValue({
            id: "provider-webhook",
            key: "webhook"
        } as never);
        prismaMock.agent.findFirst.mockResolvedValue({
            id: "agent-1",
            slug: "assistant",
            workspaceId: "workspace-1"
        } as never);
        prismaMock.agentTrigger.create.mockResolvedValue({
            id: "trigger-1"
        } as never);
        prismaMock.integrationConnection.create.mockResolvedValue({
            id: "conn-1"
        } as never);

        const request = createMockRequest("/api/integrations/webhooks", {
            method: "POST",
            body: {
                agentId: "agent-1",
                name: "Webhook Trigger",
                filter: null
            }
        });

        const response = await POST(request);
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.webhook?.path).toContain("/api/webhooks/");
        expect(result.data.webhook?.secret).toBeTruthy();
    });

    it("updates a connection", async () => {
        const { PATCH } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/route");

        prismaMock.integrationConnection.findFirst.mockResolvedValue({
            id: "conn-1",
            providerId: "provider-1",
            scope: "org",
            userId: null,
            provider: {
                id: "provider-1",
                key: "hubspot",
                name: "HubSpot",
                category: "crm",
                authType: "apiKey",
                providerType: "mcp"
            }
        } as never);
        prismaMock.integrationConnection.update.mockResolvedValue({
            id: "conn-1",
            name: "Updated"
        } as never);

        const request = createMockRequest("/api/integrations/connections/conn-1", {
            method: "PATCH",
            body: {
                name: "Updated"
            }
        });

        const response = await PATCH(request, {
            params: Promise.resolve({ connectionId: "conn-1" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(prismaMock.integrationConnection.update).toHaveBeenCalled();
    });

    it("deletes a connection", async () => {
        const { DELETE } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/route");

        prismaMock.integrationConnection.findFirst.mockResolvedValue({
            id: "conn-1",
            agentTriggerId: null,
            provider: {
                id: "provider-1",
                key: "hubspot",
                name: "HubSpot",
                category: "crm",
                authType: "apiKey",
                providerType: "mcp"
            }
        } as never);
        prismaMock.integrationConnection.delete.mockResolvedValue({ id: "conn-1" } as never);

        const request = createMockRequest("/api/integrations/connections/conn-1", {
            method: "DELETE"
        });

        const response = await DELETE(request, {
            params: Promise.resolve({ connectionId: "conn-1" })
        });
        const result = await parseResponse(response);

        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(prismaMock.integrationConnection.delete).toHaveBeenCalled();
    });
});
