import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const getSessionMock = vi.fn();
const getUserOrganizationIdMock = vi.fn();
const getIntegrationProvidersMock = vi.fn();

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

vi.mock("@repo/agentc2", () => ({
    getIntegrationProviders: getIntegrationProvidersMock
}));

describe("Integration RBAC", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
        getUserOrganizationIdMock.mockResolvedValue("org-1");
        getIntegrationProvidersMock.mockResolvedValue([]);
        prismaMock.integrationProvider.findUnique.mockResolvedValue({
            id: "provider-1",
            key: "hubspot"
        } as never);
        prismaMock.integrationConnection.create.mockResolvedValue({ id: "conn-1" } as never);
    });

    it("blocks viewers from creating connections", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/route");
        prismaMock.membership.findFirst.mockResolvedValue({ role: "viewer" } as never);

        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections", {
                method: "POST",
                body: { providerKey: "hubspot", name: "Conn", credentials: {} }
            })
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(403);
    });

    it("blocks members from creating connections", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/route");
        prismaMock.membership.findFirst.mockResolvedValue({ role: "member" } as never);

        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections", {
                method: "POST",
                body: { providerKey: "hubspot", name: "Conn", credentials: {} }
            })
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(403);
    });

    it("allows admins to create connections", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/route");
        prismaMock.membership.findFirst.mockResolvedValue({ role: "admin" } as never);

        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections", {
                method: "POST",
                body: { providerKey: "hubspot", name: "Conn", credentials: {} }
            })
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
    });

    it("allows owners to create connections", async () => {
        const { POST } =
            await import("../../../apps/agent/src/app/api/integrations/connections/route");
        prismaMock.membership.findFirst.mockResolvedValue({ role: "owner" } as never);

        const response = await POST(
            createMockRequest("http://localhost/api/integrations/connections", {
                method: "POST",
                body: { providerKey: "hubspot", name: "Conn", credentials: {} }
            })
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
    });

    it("allows viewers to read connections", async () => {
        const { GET } =
            await import("../../../apps/agent/src/app/api/integrations/connections/route");
        prismaMock.integrationConnection.findMany.mockResolvedValue([] as never);

        const response = await GET(
            createMockRequest("http://localhost/api/integrations/connections", { method: "GET" })
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
    });
});
