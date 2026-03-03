import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockRequest, createMockParams, parseResponse } from "../../utils/api-helpers";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: { JsonNull: "DbNull", DbNull: "DbNull", InputJsonValue: {} },
    RunStatus: { RUNNING: "RUNNING", COMPLETED: "COMPLETED", FAILED: "FAILED" },
    RunEnvironment: { DEVELOPMENT: "DEVELOPMENT" },
    RunTriggerType: { API: "API" }
}));

vi.mock("@repo/auth", () => ({
    auth: {
        api: { getSession: vi.fn().mockResolvedValue(null) }
    }
}));

const mockAuthenticateRequest = vi.fn();
vi.mock("@/lib/api-auth", () => ({
    authenticateRequest: (...args: unknown[]) => mockAuthenticateRequest(...args)
}));

vi.mock("@/lib/organization", () => ({
    getUserOrganizationId: vi.fn().mockResolvedValue("org-A"),
    getDefaultWorkspaceIdForUser: vi.fn().mockResolvedValue("ws-A")
}));

vi.mock("@/lib/metrics", () => ({
    refreshNetworkMetrics: vi.fn(),
    refreshWorkflowMetrics: vi.fn()
}));

vi.mock("@/lib/run-metadata", () => ({
    resolveRunEnvironment: vi.fn().mockReturnValue("DEVELOPMENT"),
    resolveRunTriggerType: vi.fn().mockReturnValue("API")
}));

vi.mock("@/lib/trigger-events", () => ({
    createTriggerEventRecord: vi.fn()
}));

vi.mock("@repo/agentc2/networks", () => ({
    buildNetworkAgent: vi.fn().mockResolvedValue({
        agent: { network: vi.fn().mockResolvedValue({ textStream: [] }) }
    })
}));

vi.mock("@/lib/network-stream-processor", () => ({
    processNetworkStreamWithSubRuns: vi.fn().mockResolvedValue({
        outputText: "test",
        outputJson: null,
        steps: [],
        totalTokens: 0,
        totalCostUsd: 0
    })
}));

const mockListConnections = vi.fn();
vi.mock("@repo/agentc2/federation", () => ({
    listConnections: (...args: unknown[]) => mockListConnections(...args),
    requestConnection: vi.fn()
}));

const ORG_A = "org-A";
const ORG_B = "org-B";

describe("Cross-Tenant Isolation", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        mockAuthenticateRequest.mockReset();
        mockListConnections.mockReset();
    });

    // ─── Unauthenticated routes return 401 ─────────────────────────

    describe("Unauthenticated routes return 401", () => {
        it("network execute returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { POST } = await import("@/app/api/networks/[slug]/execute/route");
            const req = createMockRequest("/api/networks/test/execute", {
                method: "POST",
                body: { message: "test" }
            });
            const res = await POST(req as any, {
                params: createMockParams({ slug: "test" })
            });
            expect(res.status).toBe(401);
        });

        it("workflow execute returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { POST } = await import("@/app/api/workflows/[slug]/execute/route");
            const req = createMockRequest("/api/workflows/test/execute", {
                method: "POST",
                body: { input: {} }
            });
            const res = await POST(req as any, {
                params: createMockParams({ slug: "test" })
            });
            expect(res.status).toBe(401);
        });

        it("campaign-chain returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { GET } = await import("@/app/api/godmode/campaign-chain/route");
            const req = createMockRequest("/api/godmode/campaign-chain", {
                searchParams: { campaignId: "test" }
            });
            const res = await GET(req as any);
            expect(res.status).toBe(401);
        });

        it("BIM models returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { GET } = await import("@/app/api/bim/models/route");
            const req = createMockRequest("/api/bim/models");
            const res = await GET(req as any);
            expect(res.status).toBe(401);
        });

        it("workflow stats returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { GET } = await import("@/app/api/workflows/stats/route");
            const req = createMockRequest("/api/workflows/stats");
            const res = await GET(req as any);
            expect(res.status).toBe(401);
        });

        it("triggers returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { GET } = await import("@/app/api/triggers/route");
            const req = createMockRequest("/api/triggers");
            const res = await GET(req as any);
            expect(res.status).toBe(401);
        });

        it("threads returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { GET } = await import("@/app/api/threads/route");
            const req = createMockRequest("/api/threads");
            const res = await GET(req as any);
            expect(res.status).toBe(401);
        });

        it("federation connections returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { GET } = await import("@/app/api/federation/connections/route");
            const req = createMockRequest("/api/federation/connections");
            const res = await GET(req as any);
            expect(res.status).toBe(401);
        });

        it("live runs returns 401 without auth", async () => {
            mockAuthenticateRequest.mockResolvedValue(null);
            const { GET } = await import("@/app/api/live/runs/route");
            const req = createMockRequest("/api/live/runs");
            const res = await GET(req as any);
            expect(res.status).toBe(401);
        });
    });

    // ─── Org-scoped queries prevent cross-tenant access ─────────────

    describe("Org-scoped queries prevent cross-tenant access", () => {
        it("network execute scopes query to authenticated org", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.network.findFirst.mockResolvedValue(null);

            const { POST } = await import("@/app/api/networks/[slug]/execute/route");
            const req = createMockRequest("/api/networks/orgb-network/execute", {
                method: "POST",
                body: { message: "test" }
            });
            await POST(req as any, {
                params: createMockParams({ slug: "orgb-network" })
            });

            expect(prismaMock.network.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workspace: { organizationId: ORG_A }
                    })
                })
            );
        });

        it("workflow execute scopes query to authenticated org", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.workflow.findFirst.mockResolvedValue(null);

            const { POST } = await import("@/app/api/workflows/[slug]/execute/route");
            const req = createMockRequest("/api/workflows/orgb-wf/execute", {
                method: "POST",
                body: { input: {} }
            });
            await POST(req as any, {
                params: createMockParams({ slug: "orgb-wf" })
            });

            expect(prismaMock.workflow.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workspace: { organizationId: ORG_A }
                    })
                })
            );
        });

        it("campaign-chain scopes by tenantId", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.campaign.findFirst.mockResolvedValue(null);

            const { GET } = await import("@/app/api/godmode/campaign-chain/route");
            const req = createMockRequest("/api/godmode/campaign-chain", {
                searchParams: { campaignId: "camp-1" }
            });
            await GET(req as any);

            expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        tenantId: ORG_A
                    })
                })
            );
        });

        it("BIM models scopes query to authenticated org", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.bimModel.findMany.mockResolvedValue([]);

            const { GET } = await import("@/app/api/bim/models/route");
            const req = createMockRequest("/api/bim/models");
            await GET(req as any);

            expect(prismaMock.bimModel.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workspace: { organizationId: ORG_A }
                    })
                })
            );
        });
    });

    // ─── Workflow stats org scoping ─────────────────────────────────

    describe("Workflow stats org scoping", () => {
        it("workflow stats scopes workflow query to authenticated org", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.workflow.findMany.mockResolvedValue([]);
            prismaMock.workflowRun.findMany.mockResolvedValue([]);

            const { GET } = await import("@/app/api/workflows/stats/route");
            const req = createMockRequest("/api/workflows/stats");
            await GET(req as any);

            expect(prismaMock.workflow.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { workspace: { organizationId: ORG_A } }
                })
            );
        });

        it("workflow stats scopes run query to authenticated org", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.workflow.findMany.mockResolvedValue([]);
            prismaMock.workflowRun.findMany.mockResolvedValue([]);

            const { GET } = await import("@/app/api/workflows/stats/route");
            const req = createMockRequest("/api/workflows/stats");
            await GET(req as any);

            expect(prismaMock.workflowRun.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workflow: { workspace: { organizationId: ORG_A } }
                    })
                })
            );
        });
    });

    // ─── Triggers org scoping ───────────────────────────────────────

    describe("Triggers org scoping", () => {
        it("triggers list scopes query to authenticated org", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.agentTrigger.findMany.mockResolvedValue([]);

            const { GET } = await import("@/app/api/triggers/route");
            const req = createMockRequest("/api/triggers");
            await GET(req as any);

            expect(prismaMock.agentTrigger.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        agent: { workspace: { organizationId: ORG_A } }
                    })
                })
            );
        });
    });

    // ─── Threads org scoping ────────────────────────────────────────

    describe("Threads org scoping", () => {
        it("threads list scopes groupBy query to authenticated org", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.agentRun.groupBy.mockResolvedValue([] as any);

            const { GET } = await import("@/app/api/threads/route");
            const req = createMockRequest("/api/threads");
            await GET(req as any);

            expect(prismaMock.agentRun.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        agent: { workspace: { organizationId: ORG_A } }
                    })
                })
            );
        });
    });

    // ─── Federation org scoping ─────────────────────────────────────

    describe("Federation connections org scoping", () => {
        it("passes authenticated orgId to listConnections", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            mockListConnections.mockResolvedValue([]);

            const { GET } = await import("@/app/api/federation/connections/route");
            const req = createMockRequest("/api/federation/connections");
            await GET(req as any);

            expect(mockListConnections).toHaveBeenCalledWith(ORG_A);
        });

        it("does not leak Org B connections to Org A", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            mockListConnections.mockResolvedValue([]);

            const { GET } = await import("@/app/api/federation/connections/route");
            const req = createMockRequest("/api/federation/connections");
            await GET(req as any);

            expect(mockListConnections).not.toHaveBeenCalledWith(ORG_B);
        });
    });

    // ─── Live runs org scoping ──────────────────────────────────────

    describe("Live runs org scoping", () => {
        it("agent runs are scoped to authenticated org", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: ORG_A
            });
            prismaMock.agentRun.findMany.mockResolvedValue([]);
            prismaMock.workflowRun.findMany.mockResolvedValue([]);
            prismaMock.networkRun.findMany.mockResolvedValue([]);
            prismaMock.agentVersion.findMany.mockResolvedValue([]);
            prismaMock.budgetPolicy.findMany.mockResolvedValue([]);
            prismaMock.costEvent.findMany.mockResolvedValue([]);

            const { GET } = await import("@/app/api/live/runs/route");
            const req = createMockRequest("/api/live/runs");
            await GET(req as any);

            const agentRunCalls = prismaMock.agentRun.findMany.mock.calls;
            expect(agentRunCalls.length).toBeGreaterThan(0);
            expect(agentRunCalls[0]![0]).toEqual(
                expect.objectContaining({
                    where: expect.objectContaining({
                        agent: expect.objectContaining({
                            workspace: { organizationId: ORG_A }
                        })
                    })
                })
            );
        });
    });

    // ─── Vectors routes require organization context ────────────────

    describe("Vectors routes require organization context", () => {
        it("vectors stats returns 403 without org context", async () => {
            mockAuthenticateRequest.mockResolvedValue({
                userId: "user-1",
                organizationId: undefined
            });

            const { GET } = await import("@/app/api/vectors/stats/route");
            const req = createMockRequest("/api/vectors/stats");
            const res = await GET(req as any);
            expect(res.status).toBe(403);
        });
    });
});
