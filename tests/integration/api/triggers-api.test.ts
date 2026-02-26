import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockParams, createMockRequest, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();
const authenticateRequestMock = vi.fn();
const getSessionMock = vi.fn();
const getUserOrganizationIdMock = vi.fn();

vi.mock("@repo/database", () => ({
    prisma: prismaMock
}));

vi.mock("@/lib/api-auth", () => ({
    authenticateRequest: authenticateRequestMock
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

describe("Triggers API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        authenticateRequestMock.mockResolvedValue({
            userId: "user-1",
            organizationId: "org-1"
        });
        getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
        getUserOrganizationIdMock.mockResolvedValue("org-1");
    });

    it("lists triggers and omits webhook secrets", async () => {
        const { GET } = await import("../../../apps/agent/src/app/api/triggers/route");
        prismaMock.agentTrigger.findMany.mockResolvedValue([
            {
                id: "trigger-1",
                name: "Webhook",
                triggerType: "webhook",
                webhookPath: "path",
                isActive: true,
                createdAt: new Date(),
                triggerCount: 0,
                lastTriggeredAt: null,
                description: null,
                agent: { slug: "agent", name: "Agent" }
            }
        ] as never);

        const response = await GET(createMockRequest("http://localhost/api/triggers"));
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.triggers[0].webhookSecret).toBeUndefined();
    });

    it("filters triggers by type", async () => {
        const { GET } = await import("../../../apps/agent/src/app/api/triggers/route");
        prismaMock.agentTrigger.findMany.mockResolvedValue([] as never);

        const response = await GET(
            createMockRequest("http://localhost/api/triggers", {
                searchParams: { type: "webhook" }
            })
        );
        await parseResponse(response);
        expect(prismaMock.agentTrigger.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    triggerType: "webhook"
                })
            })
        );
    });

    it("updates trigger active state", async () => {
        const { PATCH } =
            await import("../../../apps/agent/src/app/api/triggers/[triggerId]/route");
        prismaMock.membership.findFirst.mockResolvedValue({ role: "admin" } as never);
        prismaMock.agentTrigger.findFirst.mockResolvedValue({
            id: "trigger-1",
            isActive: true,
            agent: { workspace: { organizationId: "org-1" } }
        } as never);
        prismaMock.agentTrigger.update.mockResolvedValue({
            id: "trigger-1",
            isActive: false
        } as never);

        const response = await PATCH(
            createMockRequest("http://localhost/api/triggers/trigger-1", {
                method: "PATCH",
                body: { isActive: false }
            }),
            { params: createMockParams({ triggerId: "trigger-1" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
        expect(result.data.trigger.isActive).toBe(false);
    });

    it("deletes trigger and associated connection", async () => {
        const { DELETE } =
            await import("../../../apps/agent/src/app/api/triggers/[triggerId]/route");
        prismaMock.membership.findFirst.mockResolvedValue({ role: "admin" } as never);
        prismaMock.agentTrigger.findFirst.mockResolvedValue({
            id: "trigger-1",
            agent: { workspace: { organizationId: "org-1" } }
        } as never);
        prismaMock.integrationConnection.deleteMany.mockResolvedValue({ count: 1 } as never);
        prismaMock.agentTrigger.delete.mockResolvedValue({ id: "trigger-1" } as never);

        const response = await DELETE(
            createMockRequest("http://localhost/api/triggers/trigger-1", { method: "DELETE" }),
            { params: createMockParams({ triggerId: "trigger-1" }) }
        );
        const result = await parseResponse(response);
        expect(result.status).toBe(200);
        expect(prismaMock.integrationConnection.deleteMany).toHaveBeenCalled();
        expect(prismaMock.agentTrigger.delete).toHaveBeenCalled();
    });
});
