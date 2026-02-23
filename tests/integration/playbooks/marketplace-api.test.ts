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
    mockPlaybookComponent,
    generatePlaybooks,
    generateReview
} from "../../fixtures/playbooks";
import { prismaMock, resetPrismaMock, mockPrismaModule } from "../../utils/db-mock";

mockPrismaModule();

vi.mock("@/lib/authz", () => ({
    requireAuth: vi.fn().mockResolvedValue({
        context: { userId: "test-user-id", organizationId: "org-publisher-uuid" }
    })
}));

vi.mock("@/lib/organization", () => ({
    getOrganizationId: vi.fn().mockResolvedValue("org-publisher-uuid")
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

describe("Marketplace API", () => {
    beforeEach(async () => {
        resetPrismaMock();
        vi.clearAllMocks();

        const authz = await import("@/lib/authz");
        vi.mocked(authz.requireAuth).mockResolvedValue({
            context: { userId: "test-user-id", organizationId: "org-publisher-uuid" }
        } as never);
    });

    // ── Browse API (US-046, US-047, US-048) ─────────────────────────

    describe("Browse - GET /api/playbooks (US-046)", () => {
        it("should return only PUBLISHED playbooks without auth", async () => {
            const { GET } = await import("../../../apps/agent/src/app/api/playbooks/route");
            const published = generatePlaybooks(3, { status: "PUBLISHED" as never });
            prismaMock.playbook.findMany.mockResolvedValue(published as never);
            prismaMock.playbook.count.mockResolvedValue(3);

            const request = createMockRequest("/api/playbooks");
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(prismaMock.playbook.findMany).toHaveBeenCalled();
            const callArgs = prismaMock.playbook.findMany.mock.calls[0][0] as {
                where?: { status?: string };
            };
            expect(callArgs?.where?.status).toBe("PUBLISHED");
        });

        it("should support category filter", async () => {
            const { GET } = await import("../../../apps/agent/src/app/api/playbooks/route");
            prismaMock.playbook.findMany.mockResolvedValue([] as never);
            prismaMock.playbook.count.mockResolvedValue(0);

            const request = createMockRequest("/api/playbooks", {
                searchParams: { category: "support" }
            });
            const response = await GET(request);

            expect(response.status).toBe(200);
            const callArgs = prismaMock.playbook.findMany.mock.calls[0][0] as {
                where?: { category?: string };
            };
            expect(callArgs?.where?.category).toBe("support");
        });
    });

    describe("Detail - GET /api/playbooks/[slug] (US-047)", () => {
        it("should return playbook details", async () => {
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

        it("should return 404 for non-existent playbook", async () => {
            const { GET } = await import("../../../apps/agent/src/app/api/playbooks/[slug]/route");
            prismaMock.playbook.findUnique.mockResolvedValue(null as never);

            const request = createMockRequest("/api/playbooks/nonexistent");
            const response = await GET(request, {
                params: createMockParams({ slug: "nonexistent" })
            });

            expect(response.status).toBe(404);
        });
    });

    describe("Reviews - GET /api/playbooks/[slug]/reviews (US-048)", () => {
        it("should return reviews", async () => {
            const { GET } =
                await import("../../../apps/agent/src/app/api/playbooks/[slug]/reviews/route");
            const reviews = [generateReview(), generateReview()];
            prismaMock.playbook.findUnique.mockResolvedValue(mockPublishedPlaybook as never);
            prismaMock.playbookReview.findMany.mockResolvedValue(reviews as never);
            prismaMock.playbookReview.count.mockResolvedValue(2);

            const request = createMockRequest("/api/playbooks/published-support-network/reviews");
            const response = await GET(request, {
                params: createMockParams({ slug: "published-support-network" })
            });

            expect(response.status).toBe(200);
        });
    });

    // ── Builder API (US-041 - US-045) ─────────────────────────────

    describe("Create - POST /api/playbooks (US-041)", () => {
        it("should create a playbook draft", async () => {
            const { POST } = await import("../../../apps/agent/src/app/api/playbooks/route");
            prismaMock.playbook.findUnique.mockResolvedValue(null as never);
            prismaMock.playbook.create.mockResolvedValue(mockPlaybook as never);

            const request = createMockRequest("/api/playbooks", {
                method: "POST",
                body: {
                    name: "Customer Support Network",
                    slug: "customer-support-network",
                    description: "A support network",
                    category: "support"
                }
            });
            const response = await POST(request);

            expect(response.status).toBe(201);
            expect(prismaMock.playbook.create).toHaveBeenCalled();
        });

        it("should reject duplicate slug", async () => {
            const { POST } = await import("../../../apps/agent/src/app/api/playbooks/route");
            prismaMock.playbook.findUnique.mockResolvedValue(mockPlaybook as never);

            const request = createMockRequest("/api/playbooks", {
                method: "POST",
                body: {
                    name: "Duplicate",
                    slug: "customer-support-network",
                    description: "Duplicate",
                    category: "support"
                }
            });
            const response = await POST(request);

            expect(response.status).toBe(409);
        });
    });

    describe("Publish - POST /api/playbooks/[slug]/publish (US-044)", () => {
        it("should submit playbook for review", async () => {
            const { POST } =
                await import("../../../apps/agent/src/app/api/playbooks/[slug]/publish/route");
            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPlaybook,
                components: [mockPlaybookComponent],
                versions: [mockPlaybookVersion]
            } as never);
            prismaMock.playbook.update.mockResolvedValue({
                ...mockPlaybook,
                status: "PENDING_REVIEW"
            } as never);

            const request = createMockRequest("/api/playbooks/customer-support-network/publish", {
                method: "POST"
            });
            const response = await POST(request, {
                params: createMockParams({ slug: "customer-support-network" })
            });

            expect(response.status).toBe(200);
        });

        it("should reject publish without components", async () => {
            const { POST } =
                await import("../../../apps/agent/src/app/api/playbooks/[slug]/publish/route");
            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPlaybook,
                components: [],
                versions: [mockPlaybookVersion]
            } as never);

            const request = createMockRequest("/api/playbooks/customer-support-network/publish", {
                method: "POST"
            });
            const response = await POST(request, {
                params: createMockParams({ slug: "customer-support-network" })
            });

            expect(response.status).toBe(400);
        });
    });

    describe("My Published - GET /api/playbooks/my/published (US-045)", () => {
        it("should return only current org playbooks", async () => {
            const { GET } =
                await import("../../../apps/agent/src/app/api/playbooks/my/published/route");
            const myPlaybooks = generatePlaybooks(2, {
                publisherOrgId: "org-publisher-uuid"
            });
            prismaMock.playbook.findMany.mockResolvedValue(myPlaybooks as never);

            const request = createMockRequest("/api/playbooks/my/published");
            const response = await GET(request);

            expect(response.status).toBe(200);
            const callArgs = prismaMock.playbook.findMany.mock.calls[0][0] as {
                where?: { publisherOrgId?: string };
            };
            expect(callArgs?.where?.publisherOrgId).toBe("org-publisher-uuid");
        });
    });

    // ── Purchase API (US-049 - US-051) ──────────────────────────────

    describe("Purchase Free - POST /api/playbooks/[slug]/purchase (US-049)", () => {
        it("should create free purchase with COMPLETED status", async () => {
            const authz = await import("@/lib/authz");
            vi.mocked(authz.requireAuth).mockResolvedValue({
                context: { userId: "buyer-user-id", organizationId: "org-buyer-uuid" }
            } as never);

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
            const createCall = prismaMock.playbookPurchase.create.mock.calls[0][0] as {
                data: { amountUsd?: number; status?: string };
            };
            expect(createCall.data.amountUsd).toBe(0);
            expect(createCall.data.status).toBe("COMPLETED");
        });

        it("should reject purchasing own playbook", async () => {
            const { POST } =
                await import("../../../apps/agent/src/app/api/playbooks/[slug]/purchase/route");
            prismaMock.playbook.findUnique.mockResolvedValue(mockPublishedPlaybook as never);

            const request = createMockRequest("/api/playbooks/published-support-network/purchase", {
                method: "POST"
            });
            const response = await POST(request, {
                params: createMockParams({ slug: "published-support-network" })
            });

            expect(response.status).toBe(400);
        });
    });

    // ── Deploy API (US-052 - US-054) ────────────────────────────────

    describe("Deploy - POST /api/playbooks/[slug]/deploy (US-052)", () => {
        it("should deploy and return 201", async () => {
            const authz = await import("@/lib/authz");
            vi.mocked(authz.requireAuth).mockResolvedValue({
                context: { userId: "buyer-user-id", organizationId: "org-buyer-uuid" }
            } as never);

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

    // ── Review API (US-055) ─────────────────────────────────────────

    describe("Submit Review - POST /api/playbooks/[slug]/reviews (US-055)", () => {
        it("should create review and update playbook averageRating", async () => {
            const { POST } =
                await import("../../../apps/agent/src/app/api/playbooks/[slug]/reviews/route");

            const authz = await import("@/lib/authz");
            vi.mocked(authz.requireAuth).mockResolvedValue({
                context: { userId: "buyer-user-id", organizationId: "org-buyer-uuid" }
            } as never);

            prismaMock.playbook.findUnique.mockResolvedValue(mockPublishedPlaybook as never);
            prismaMock.playbookInstallation.findUnique.mockResolvedValue({
                ...mockPlaybookInstallation,
                status: "ACTIVE"
            } as never);
            prismaMock.playbookReview.upsert.mockResolvedValue(mockPlaybookReview as never);
            prismaMock.playbookReview.aggregate.mockResolvedValue({
                _avg: { rating: 4.5 },
                _count: { rating: 3 }
            } as never);
            prismaMock.playbook.update.mockResolvedValue({
                ...mockPublishedPlaybook,
                averageRating: 4.5,
                reviewCount: 3
            } as never);

            const request = createMockRequest("/api/playbooks/published-support-network/reviews", {
                method: "POST",
                body: {
                    rating: 5,
                    title: "Excellent",
                    body: "Works perfectly."
                }
            });
            const response = await POST(request, {
                params: createMockParams({ slug: "published-support-network" })
            });

            expect(response.status).toBe(201);
        });
    });

    // ── Uninstall API (US-056) ──────────────────────────────────────

    describe("Uninstall - DELETE /api/playbooks/my/installed/[id] (US-056)", () => {
        it("should uninstall and return 200", async () => {
            const { DELETE: uninstall } =
                await import("../../../apps/agent/src/app/api/playbooks/my/installed/[id]/route");
            prismaMock.playbookInstallation.findUnique.mockResolvedValue({
                ...mockPlaybookInstallation,
                targetOrgId: "org-publisher-uuid"
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

    // ── Admin API (US-057 - US-059) ─────────────────────────────────

    describe("Admin Moderation (US-057 - US-059)", () => {
        it("should approve a playbook pending review (US-057)", async () => {
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
            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        it("should reject invalid status transitions (US-089)", async () => {
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

        it("should suspend a published playbook (US-058)", async () => {
            const { PATCH } =
                await import("../../../apps/agent/src/app/api/admin/playbooks/[id]/status/route");
            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPlaybook,
                status: "PUBLISHED"
            } as never);
            prismaMock.playbook.update.mockResolvedValue({
                ...mockPlaybook,
                status: "SUSPENDED"
            } as never);
            prismaMock.auditLog.create.mockResolvedValue({} as never);

            const request = createMockRequest("/api/admin/playbooks/playbook-uuid/status", {
                method: "PATCH",
                body: { status: "SUSPENDED", reason: "Policy violation" }
            });
            const response = await PATCH(request, {
                params: createMockParams({ id: "playbook-uuid" })
            });

            expect(response.status).toBe(200);
        });

        it("should return manifest for security review (US-059)", async () => {
            const { GET } =
                await import("../../../apps/agent/src/app/api/admin/playbooks/[id]/manifest/route");
            prismaMock.playbook.findUnique.mockResolvedValue({
                ...mockPlaybook,
                versions: [mockPlaybookVersion],
                components: [mockPlaybookComponent]
            } as never);

            const request = createMockRequest("/api/admin/playbooks/playbook-uuid/manifest");
            const response = await GET(request, {
                params: createMockParams({ id: "playbook-uuid" })
            });

            expect(response.status).toBe(200);
            const { data } = await parseResponse<{ manifest: unknown }>(response);
            expect(data).toBeDefined();
        });
    });
});
