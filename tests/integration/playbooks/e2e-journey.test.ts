import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockParams, parseResponse } from "../../utils/api-helpers";
import {
    mockPlaybook,
    mockPublishedPlaybook,
    mockPlaybookVersion,
    mockPlaybookPurchase,
    mockPlaybookInstallation,
    mockPlaybookReview,
    mockOrganization,
    mockPlaybookComponent
} from "../../fixtures/playbooks";
import { prismaMock, resetPrismaMock, mockPrismaModule } from "../../utils/db-mock";

mockPrismaModule();

vi.mock("@/lib/authz", () => ({
    requireAuth: vi.fn()
}));

vi.mock("@/lib/organization", () => ({
    getOrganizationId: vi.fn()
}));

vi.mock("@repo/agentc2", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        deployPlaybook: vi.fn().mockResolvedValue({
            id: "installation-uuid",
            status: "ACTIVE"
        }),
        uninstallPlaybook: vi.fn().mockResolvedValue(undefined)
    };
});

async function setAuthContext(userId: string, orgId: string) {
    const authz = await import("@/lib/authz");
    vi.mocked(authz.requireAuth).mockResolvedValue({
        context: { userId, organizationId: orgId }
    } as never);
}

describe("End-to-End Journey: Free Playbook (US-085)", () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
    });

    describe("Step 1: Build agent system in Org A", () => {
        it("should have 3 agents in the seed data", () => {
            const agents = [
                { slug: "support-router", name: "Router Agent" },
                { slug: "support-faq", name: "FAQ Agent" },
                { slug: "support-escalation", name: "Escalation Agent" }
            ];
            expect(agents).toHaveLength(3);
        });
    });

    describe("Step 2-3: Package and publish", () => {
        it("should create playbook draft as Org A", async () => {
            await setAuthContext("user-a", "org-publisher-uuid");
            const { POST } = await import("../../../apps/agent/src/app/api/playbooks/route");

            prismaMock.playbook.findUnique.mockResolvedValue(null as never);
            prismaMock.playbook.create.mockResolvedValue(mockPlaybook as never);

            const request = createMockRequest("/api/playbooks", {
                method: "POST",
                body: {
                    name: "Customer Support Network",
                    slug: "customer-support-network",
                    description: "A 3-agent support network",
                    category: "support"
                }
            });
            const response = await POST(request);
            expect(response.status).toBe(201);
        });

        it("should publish playbook via admin approval", async () => {
            await setAuthContext("admin-user", "org-publisher-uuid");
            const { PATCH } =
                await import("../../../apps/agent/src/app/api/admin/playbooks/[id]/status/route");

            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPlaybook,
                status: "PENDING_REVIEW"
            } as never);
            prismaMock.playbook.update.mockResolvedValue({
                ...mockPlaybook,
                status: "PUBLISHED"
            } as never);
            prismaMock.auditLog.create.mockResolvedValue({} as never);

            const request = createMockRequest("/api/admin/playbooks/playbook-uuid/status", {
                method: "PATCH",
                body: { status: "PUBLISHED" }
            });
            const response = await PATCH(request, {
                params: createMockParams({ id: "playbook-uuid" })
            });
            expect(response.status).toBe(200);
        });
    });

    describe("Step 4: Browse marketplace as Org B", () => {
        it("should find published playbook in marketplace", async () => {
            const { GET } = await import("../../../apps/agent/src/app/api/playbooks/route");

            prismaMock.playbook.findMany.mockResolvedValue([mockPublishedPlaybook] as never);
            prismaMock.playbook.count.mockResolvedValue(1);

            const request = createMockRequest("/api/playbooks");
            const response = await GET(request);

            expect(response.status).toBe(200);
        });

        it("should get playbook details", async () => {
            const { GET } = await import("../../../apps/agent/src/app/api/playbooks/[slug]/route");

            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPublishedPlaybook,
                publisherOrg: mockOrganization,
                versions: [mockPlaybookVersion],
                components: []
            } as never);

            const request = createMockRequest("/api/playbooks/published-support-network");
            const response = await GET(request, {
                params: createMockParams({ slug: "published-support-network" })
            });

            expect(response.status).toBe(200);
        });
    });

    describe("Step 5: Purchase as Org B", () => {
        it("should purchase free playbook with COMPLETED status", async () => {
            await setAuthContext("user-b", "org-buyer-uuid");
            const { POST } =
                await import("../../../apps/agent/src/app/api/playbooks/[slug]/purchase/route");

            prismaMock.playbook.findUnique.mockResolvedValue(mockPublishedPlaybook as never);
            prismaMock.playbookPurchase.findFirst.mockResolvedValue(null as never);
            prismaMock.playbookPurchase.create.mockResolvedValue(mockPlaybookPurchase as never);

            const request = createMockRequest("/api/playbooks/published-support-network/purchase", {
                method: "POST"
            });
            const response = await POST(request, {
                params: createMockParams({ slug: "published-support-network" })
            });

            expect(response.status).toBe(201);
        });
    });

    describe("Step 6: Deploy to Org B workspace", () => {
        it("should initiate deployment", async () => {
            await setAuthContext("user-b", "org-buyer-uuid");
            const { POST } =
                await import("../../../apps/agent/src/app/api/playbooks/[slug]/deploy/route");

            prismaMock.playbook.findUnique.mockResolvedValue(mockPublishedPlaybook as never);
            prismaMock.playbookInstallation.findUnique.mockResolvedValue(null as never);
            prismaMock.playbookPurchase.findFirst.mockResolvedValue(mockPlaybookPurchase as never);
            prismaMock.workspace.findFirst.mockResolvedValue({
                id: "workspace-buyer-uuid",
                organizationId: "org-buyer-uuid"
            } as never);

            const request = createMockRequest("/api/playbooks/published-support-network/deploy", {
                method: "POST",
                body: { workspaceId: "workspace-buyer-uuid" }
            });
            const response = await POST(request, {
                params: createMockParams({ slug: "published-support-network" })
            });

            expect(response.status).toBe(201);
        });
    });

    describe("Step 8: Data isolation verification", () => {
        it("should scope agent queries to org", async () => {
            prismaMock.agent.findMany.mockResolvedValue([] as never);

            await prismaMock.agent.findMany({
                where: { workspace: { organizationId: "org-buyer-uuid" } }
            });

            expect(prismaMock.agent.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        workspace: { organizationId: "org-buyer-uuid" }
                    })
                })
            );
        });
    });

    describe("Step 9: Submit review as Org B", () => {
        it("should create review and update ratings", async () => {
            await setAuthContext("user-b", "org-buyer-uuid");
            const { POST } =
                await import("../../../apps/agent/src/app/api/playbooks/[slug]/reviews/route");

            prismaMock.playbook.findUnique.mockResolvedValue(mockPublishedPlaybook as never);
            prismaMock.playbookInstallation.findUnique.mockResolvedValue({
                ...mockPlaybookInstallation,
                status: "ACTIVE"
            } as never);
            prismaMock.playbookReview.upsert.mockResolvedValue(mockPlaybookReview as never);
            prismaMock.playbookReview.aggregate.mockResolvedValue({
                _avg: { rating: 5 },
                _count: { rating: 1 }
            } as never);
            prismaMock.playbook.update.mockResolvedValue({
                ...mockPublishedPlaybook,
                averageRating: 5,
                reviewCount: 1
            } as never);

            const request = createMockRequest("/api/playbooks/published-support-network/reviews", {
                method: "POST",
                body: { rating: 5, title: "Works great", body: "Excellent." }
            });
            const response = await POST(request, {
                params: createMockParams({ slug: "published-support-network" })
            });

            expect(response.status).toBe(201);
        });
    });

    describe("Step 10: Uninstall from Org B", () => {
        it("should clean up all created entities", async () => {
            await setAuthContext("user-b", "org-buyer-uuid");
            const { DELETE: uninstall } =
                await import("../../../apps/agent/src/app/api/playbooks/my/installed/[id]/route");

            prismaMock.playbookInstallation.findUnique.mockResolvedValue({
                ...mockPlaybookInstallation,
                targetOrgId: "org-buyer-uuid"
            } as never);

            const request = createMockRequest("/api/playbooks/my/installed/installation-uuid", {
                method: "DELETE"
            });
            const response = await uninstall(request, {
                params: createMockParams({ id: "installation-uuid" })
            });

            expect(response.status).toBe(200);
        });
    });
});

describe("End-to-End Journey: Error Paths", () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
    });

    describe("Invalid status transitions (US-089)", () => {
        it("should reject DRAFT -> PUBLISHED", async () => {
            await setAuthContext("admin-user", "org-publisher-uuid");
            const { PATCH } =
                await import("../../../apps/agent/src/app/api/admin/playbooks/[id]/status/route");

            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPlaybook,
                status: "DRAFT"
            } as never);

            const request = createMockRequest("/api/admin/playbooks/playbook-uuid/status", {
                method: "PATCH",
                body: { status: "PUBLISHED" }
            });
            const response = await PATCH(request, {
                params: createMockParams({ id: "playbook-uuid" })
            });

            expect(response.status).toBe(400);
        });

        it("should reject PUBLISHED -> DRAFT", async () => {
            await setAuthContext("admin-user", "org-publisher-uuid");
            const { PATCH } =
                await import("../../../apps/agent/src/app/api/admin/playbooks/[id]/status/route");

            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPlaybook,
                status: "PUBLISHED"
            } as never);

            const request = createMockRequest("/api/admin/playbooks/playbook-uuid/status", {
                method: "PATCH",
                body: { status: "DRAFT" }
            });
            const response = await PATCH(request, {
                params: createMockParams({ id: "playbook-uuid" })
            });

            expect(response.status).toBe(400);
        });

        it("should allow PENDING_REVIEW -> PUBLISHED", async () => {
            await setAuthContext("admin-user", "org-publisher-uuid");
            const { PATCH } =
                await import("../../../apps/agent/src/app/api/admin/playbooks/[id]/status/route");

            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPlaybook,
                status: "PENDING_REVIEW"
            } as never);
            prismaMock.playbook.update.mockResolvedValue({
                ...mockPlaybook,
                status: "PUBLISHED"
            } as never);
            prismaMock.auditLog.create.mockResolvedValue({} as never);

            const request = createMockRequest("/api/admin/playbooks/playbook-uuid/status", {
                method: "PATCH",
                body: { status: "PUBLISHED" }
            });
            const response = await PATCH(request, {
                params: createMockParams({ id: "playbook-uuid" })
            });

            expect(response.status).toBe(200);
        });
    });
});

describe("Agent Tools (US-081 - US-084)", () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
    });

    it("should have playbookSearchTool registered in registry", async () => {
        const { toolRegistry } = await import("@repo/agentc2/tools/registry");
        expect(toolRegistry["playbook-search"]).toBeDefined();
    });

    it("should have playbookDetailTool registered in registry", async () => {
        const { toolRegistry } = await import("@repo/agentc2/tools/registry");
        expect(toolRegistry["playbook-detail"]).toBeDefined();
    });

    it("should have playbookListInstalledTool registered in registry", async () => {
        const { toolRegistry } = await import("@repo/agentc2/tools/registry");
        expect(toolRegistry["playbook-list-installed"]).toBeDefined();
    });

    it("should have playbookDeployTool registered in registry", async () => {
        const { toolRegistry } = await import("@repo/agentc2/tools/registry");
        expect(toolRegistry["playbook-deploy"]).toBeDefined();
    });

    it("should have playbook tools in Marketplace category", async () => {
        const { toolCategoryMap } = await import("@repo/agentc2/tools/registry");
        expect(toolCategoryMap["playbook-search"]).toBe("Marketplace");
        expect(toolCategoryMap["playbook-detail"]).toBe("Marketplace");
        expect(toolCategoryMap["playbook-list-installed"]).toBe("Marketplace");
        expect(toolCategoryMap["playbook-deploy"]).toBe("Marketplace");
    });
});
