import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockParams, createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const getSessionMock = vi.fn();
const getUserOrganizationIdMock = vi.fn();
const getMcpToolsMock = vi.fn();

vi.mock("@repo/database", () => ({
    prisma: prismaMock
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

vi.mock("@repo/mastra/mcp", () => ({
    getMcpTools: getMcpToolsMock
}));

describe("Integration connection actions API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
        getUserOrganizationIdMock.mockResolvedValue("org-1");
    });

    it("returns 401 when unauthorized", async () => {
        const { GET } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/actions/route");
        getSessionMock.mockResolvedValue(null);
        const response = await GET(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/actions"),
            {
                params: createMockParams({ connectionId: "conn-1" })
            }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(401);
    });

    it("returns 404 when connection is not found", async () => {
        const { GET } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/actions/route");
        prismaMock.integrationConnection.findFirst.mockResolvedValue(null);
        const response = await GET(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/actions"),
            {
                params: createMockParams({ connectionId: "conn-1" })
            }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(404);
    });

    it("returns filtered MCP tool actions", async () => {
        const { GET } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/actions/route");
        prismaMock.integrationConnection.findFirst.mockResolvedValue({
            id: "conn-1",
            isDefault: true,
            provider: {
                key: "hubspot",
                providerType: "mcp",
                triggersJson: null
            }
        } as never);
        getMcpToolsMock.mockResolvedValue({
            tools: {
                hubspot_toolA: { description: "A", parameters: { type: "object" } },
                hubspot_toolB: { description: "B", parameters: { type: "object" } },
                other_tool: { description: "C", parameters: { type: "object" } }
            }
        });

        const response = await GET(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/actions"),
            {
                params: createMockParams({ connectionId: "conn-1" })
            }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
        expect(result.data).toMatchObject({
            success: true,
            actions: [
                { name: "hubspot_toolA", description: "A" },
                { name: "hubspot_toolB", description: "B" }
            ]
        });
    });

    it("returns provider metadata for non-MCP providers", async () => {
        const { GET } =
            await import("../../../apps/agent/src/app/api/integrations/connections/[connectionId]/actions/route");
        prismaMock.integrationConnection.findFirst.mockResolvedValue({
            id: "conn-1",
            provider: {
                providerType: "oauth",
                actionsJson: { actions: [{ name: "action" }] },
                triggersJson: { triggers: [{ name: "trigger" }] }
            }
        } as never);

        const response = await GET(
            createMockRequest("http://localhost/api/integrations/connections/conn-1/actions"),
            {
                params: createMockParams({ connectionId: "conn-1" })
            }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
        expect(result.data).toMatchObject({
            success: true,
            actions: { actions: [{ name: "action" }] },
            triggers: { triggers: [{ name: "trigger" }] }
        });
    });
});
