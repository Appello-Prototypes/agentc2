import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockParams, createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const getSessionMock = vi.fn();
const getUserOrganizationIdMock = vi.fn();
const testMcpServerMock = vi.fn();

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

vi.mock("@repo/agentc2/mcp", () => ({
    testMcpServer: testMcpServerMock
}));

describe("Integration connection test API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
        getUserOrganizationIdMock.mockResolvedValue("org-1");
    });

    it("returns 401 when unauthorized", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/test/route");
        getSessionMock.mockResolvedValue(null);
        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/test", {
                method: "POST"
            }),
            { params: createMockParams({ connectionId: "conn-1" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(401);
    });

    it("returns 403 when organization is missing", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/test/route");
        getUserOrganizationIdMock.mockResolvedValue(null);
        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/test", {
                method: "POST"
            }),
            { params: createMockParams({ connectionId: "conn-1" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(403);
    });

    it("returns 404 when connection is not found", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/test/route");
        prismaMock.integrationConnection.findFirst.mockResolvedValue(null);
        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/test", {
                method: "POST"
            }),
            { params: createMockParams({ connectionId: "conn-1" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(404);
    });

    it("returns missing credential errors for apiKey providers", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/test/route");
        prismaMock.integrationConnection.findFirst.mockResolvedValue({
            id: "conn-1",
            provider: {
                key: "hubspot",
                authType: "apiKey",
                providerType: "mcp",
                configJson: { requiredFields: ["TOKEN"] }
            },
            credentials: {}
        } as never);
        prismaMock.integrationConnection.update.mockResolvedValue({} as never);

        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/test", {
                method: "POST"
            }),
            { params: createMockParams({ connectionId: "conn-1" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(400);
        expect(result.data).toMatchObject({
            success: false,
            error: "Missing required credentials"
        });
    });

    it("returns tool count for MCP providers", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/test/route");
        prismaMock.integrationConnection.findFirst.mockResolvedValue({
            id: "conn-1",
            provider: {
                key: "hubspot",
                authType: "apiKey",
                providerType: "mcp",
                configJson: { requiredFields: [] }
            },
            credentials: { TOKEN: "ok" },
            isDefault: true
        } as never);
        prismaMock.integrationConnection.update.mockResolvedValue({} as never);
        testMcpServerMock.mockResolvedValue({
            success: true,
            toolCount: 2,
            sampleTools: ["hubspot_toolA", "hubspot_toolB"],
            totalMs: 10,
            phases: []
        });

        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/test", {
                method: "POST"
            }),
            { params: createMockParams({ connectionId: "conn-1" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
        expect(result.data).toMatchObject({
            success: true,
            toolCount: 2
        });
    });

    it("returns connection status for oauth providers", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/test/route");
        prismaMock.integrationConnection.findFirst.mockResolvedValue({
            id: "conn-1",
            provider: {
                key: "gmail",
                authType: "oauth",
                providerType: "oauth",
                configJson: {}
            },
            credentials: { accessToken: "token" }
        } as never);
        prismaMock.integrationConnection.update.mockResolvedValue({} as never);

        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/test", {
                method: "POST"
            }),
            { params: createMockParams({ connectionId: "conn-1" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
        expect(result.data).toMatchObject({ success: true, connected: true });
    });
});
