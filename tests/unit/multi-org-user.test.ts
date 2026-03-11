import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock
}));

const mockGetSession = vi.fn();
vi.mock("@repo/auth", () => ({
    auth: {
        api: { getSession: mockGetSession }
    }
}));

vi.mock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue(new Headers()),
    cookies: vi.fn().mockImplementation(() => {
        throw new Error("cookies() not available in test");
    })
}));

const mockValidateAccessToken = vi.fn();
vi.mock("@/lib/mcp-oauth", () => ({
    validateAccessToken: (...args: unknown[]) => mockValidateAccessToken(...args)
}));

const mockValidateStoredApiKey = vi.fn();
vi.mock("@/lib/api-key-hash", () => ({
    validateStoredApiKey: (...args: unknown[]) => mockValidateStoredApiKey(...args)
}));

const ORG_A = "org-A";
const ORG_B = "org-B";
const ORG_C = "org-C";
const USER_1 = "user-1";
const USER_OWNER_A = "user-owner-A";
const USER_OWNER_B = "user-owner-B";

describe("Multi-Org User Resolution", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        mockValidateAccessToken.mockReset();
        mockValidateStoredApiKey.mockReset();
        vi.clearAllMocks();
        delete process.env.MCP_API_KEY;
        delete process.env.MCP_API_ORGANIZATION_SLUG;
    });

    describe("getUserOrganizationId", () => {
        it("returns first org by createdAt when no preferredOrgId is provided", async () => {
            prismaMock.membership.findFirst.mockResolvedValue({
                id: "m1",
                userId: USER_1,
                organizationId: ORG_A,
                role: "member",
                permissions: [],
                createdAt: new Date("2024-01-01"),
                onboardingCompletedAt: null
            } as any);

            const { getUserOrganizationId } = await import("@/lib/organization");
            const result = await getUserOrganizationId(USER_1);

            expect(result).toBe(ORG_A);
            expect(prismaMock.membership.findFirst).toHaveBeenCalledWith({
                where: { userId: USER_1 },
                orderBy: { createdAt: "asc" }
            });
        });

        it("returns preferredOrgId when user has membership in that org", async () => {
            prismaMock.membership.findUnique.mockResolvedValue({
                organizationId: ORG_B
            } as any);

            const { getUserOrganizationId } = await import("@/lib/organization");
            const result = await getUserOrganizationId(USER_1, ORG_B);

            expect(result).toBe(ORG_B);
            expect(prismaMock.membership.findUnique).toHaveBeenCalledWith({
                where: {
                    userId_organizationId: { userId: USER_1, organizationId: ORG_B }
                },
                select: { organizationId: true }
            });
            expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
        });

        it("falls back to default org when preferredOrgId has no membership", async () => {
            prismaMock.membership.findUnique.mockResolvedValue(null);
            prismaMock.membership.findFirst.mockResolvedValue({
                id: "m1",
                userId: USER_1,
                organizationId: ORG_A,
                role: "member",
                permissions: [],
                createdAt: new Date("2024-01-01"),
                onboardingCompletedAt: null
            } as any);

            const { getUserOrganizationId } = await import("@/lib/organization");
            const result = await getUserOrganizationId(USER_1, ORG_C);

            expect(result).toBe(ORG_A);
            expect(prismaMock.membership.findUnique).toHaveBeenCalledWith({
                where: {
                    userId_organizationId: { userId: USER_1, organizationId: ORG_C }
                },
                select: { organizationId: true }
            });
            expect(prismaMock.membership.findFirst).toHaveBeenCalled();
        });

        it("returns null when user has no memberships at all", async () => {
            prismaMock.membership.findFirst.mockResolvedValue(null);

            const { getUserOrganizationId } = await import("@/lib/organization");
            const result = await getUserOrganizationId(USER_1);

            expect(result).toBeNull();
        });

        it("treats null preferredOrgId same as undefined", async () => {
            prismaMock.membership.findFirst.mockResolvedValue({
                id: "m1",
                userId: USER_1,
                organizationId: ORG_A,
                role: "member",
                permissions: [],
                createdAt: new Date("2024-01-01"),
                onboardingCompletedAt: null
            } as any);

            const { getUserOrganizationId } = await import("@/lib/organization");
            const result = await getUserOrganizationId(USER_1, null);

            expect(result).toBe(ORG_A);
            expect(prismaMock.membership.findUnique).not.toHaveBeenCalled();
        });
    });

    describe("getDefaultWorkspaceIdForUser", () => {
        it("returns workspace from the preferred org when preferredOrgId is valid", async () => {
            prismaMock.membership.findUnique.mockResolvedValue({
                organizationId: ORG_B
            } as any);
            prismaMock.workspace.findFirst.mockResolvedValue({
                id: "ws-B-default"
            } as any);

            const { getDefaultWorkspaceIdForUser } = await import("@/lib/organization");
            const result = await getDefaultWorkspaceIdForUser(USER_1, ORG_B);

            expect(result).toBe("ws-B-default");
            expect(prismaMock.workspace.findFirst).toHaveBeenCalledWith({
                where: { organizationId: ORG_B, isDefault: true },
                orderBy: { createdAt: "asc" }
            });
        });

        it("returns workspace from default org when no preferredOrgId", async () => {
            prismaMock.membership.findFirst.mockResolvedValue({
                id: "m1",
                userId: USER_1,
                organizationId: ORG_A,
                role: "member",
                permissions: [],
                createdAt: new Date("2024-01-01"),
                onboardingCompletedAt: null
            } as any);
            prismaMock.workspace.findFirst.mockResolvedValue({
                id: "ws-A-default"
            } as any);

            const { getDefaultWorkspaceIdForUser } = await import("@/lib/organization");
            const result = await getDefaultWorkspaceIdForUser(USER_1);

            expect(result).toBe("ws-A-default");
            expect(prismaMock.workspace.findFirst).toHaveBeenCalledWith({
                where: { organizationId: ORG_A, isDefault: true },
                orderBy: { createdAt: "asc" }
            });
        });

        it("returns null when user has no memberships", async () => {
            prismaMock.membership.findFirst.mockResolvedValue(null);

            const { getDefaultWorkspaceIdForUser } = await import("@/lib/organization");
            const result = await getDefaultWorkspaceIdForUser(USER_1);

            expect(result).toBeNull();
        });
    });

    describe("authenticateRequest - session with X-Organization-Id header", () => {
        it("uses X-Organization-Id header to select org when user has membership", async () => {
            const { auth } = await import("@repo/auth");
            (auth.api.getSession as any).mockResolvedValue({
                user: { id: USER_1 },
                session: { id: "sess-1" }
            });

            prismaMock.membership.findUnique.mockResolvedValue({
                organizationId: ORG_B
            } as any);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test", {
                headers: { "x-organization-id": ORG_B }
            });
            const result = await authenticateRequest(request as any);

            expect(result).toEqual({ userId: USER_1, organizationId: ORG_B });
        });

        it("falls back to default org when X-Organization-Id org has no membership", async () => {
            const { auth } = await import("@repo/auth");
            (auth.api.getSession as any).mockResolvedValue({
                user: { id: USER_1 },
                session: { id: "sess-1" }
            });

            prismaMock.membership.findUnique.mockResolvedValue(null);
            prismaMock.membership.findFirst.mockResolvedValue({
                id: "m1",
                userId: USER_1,
                organizationId: ORG_A,
                role: "member",
                permissions: [],
                createdAt: new Date("2024-01-01"),
                onboardingCompletedAt: null
            } as any);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test", {
                headers: { "x-organization-id": ORG_C }
            });
            const result = await authenticateRequest(request as any);

            expect(result).toEqual({ userId: USER_1, organizationId: ORG_A });
        });

        it("works without X-Organization-Id header (default behavior)", async () => {
            mockGetSession.mockResolvedValue({
                user: { id: USER_1 },
                session: { id: "sess-1" }
            });

            prismaMock.membership.findUnique.mockResolvedValue(null);
            prismaMock.membership.findFirst.mockResolvedValue({
                id: "m1",
                userId: USER_1,
                organizationId: ORG_A,
                role: "member",
                permissions: [],
                createdAt: new Date("2024-01-01"),
                onboardingCompletedAt: null
            } as any);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test");
            const result = await authenticateRequest(request as any);

            expect(result).toEqual({ userId: USER_1, organizationId: ORG_A });
        });
    });

    describe("authenticateRequest - OAuth token uses org owner", () => {
        it("uses org owner userId instead of random member", async () => {
            mockValidateAccessToken.mockReturnValue({ organizationId: ORG_A });
            prismaMock.membership.findFirst.mockResolvedValue({
                userId: USER_OWNER_A
            } as any);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test", {
                headers: { "x-api-key": "mcp_at_test-token" }
            });
            const result = await authenticateRequest(request as any);

            expect(result).toEqual({ userId: USER_OWNER_A, organizationId: ORG_A });
            expect(prismaMock.membership.findFirst).toHaveBeenCalledWith({
                where: { organizationId: ORG_A, role: "owner" },
                select: { userId: true }
            });
        });

        it("returns null when org has no owner", async () => {
            mockValidateAccessToken.mockReturnValue({ organizationId: ORG_A });
            prismaMock.membership.findFirst.mockResolvedValue(null);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test", {
                headers: { "x-api-key": "mcp_at_test-token" }
            });
            const result = await authenticateRequest(request as any);

            expect(result).toBeNull();
        });
    });

    describe("authenticateRequest - MCP_API_KEY resolveOrgContext uses owner", () => {
        it("resolves to org owner when using MCP_API_KEY env var", async () => {
            process.env.MCP_API_KEY = "test-mcp-key";
            process.env.MCP_API_ORGANIZATION_SLUG = "alpha-org";
            mockValidateAccessToken.mockReturnValue(null);

            prismaMock.organization.findUnique.mockResolvedValue({ id: ORG_A } as any);
            prismaMock.membership.findFirst.mockResolvedValue({
                userId: USER_OWNER_A
            } as any);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test", {
                headers: { "x-api-key": "test-mcp-key" }
            });
            const result = await authenticateRequest(request as any);

            expect(result).toEqual({ userId: USER_OWNER_A, organizationId: ORG_A });
            expect(prismaMock.membership.findFirst).toHaveBeenCalledWith({
                where: { organizationId: ORG_A, role: "owner" },
                select: { userId: true }
            });
        });
    });

    describe("authenticateRequest - ToolCredential uses createdBy", () => {
        it("uses credential createdBy as userIdHint for org context", async () => {
            mockValidateAccessToken.mockReturnValue(null);
            mockValidateStoredApiKey.mockReturnValue(true);

            const credCreator = "user-cred-creator";

            // First org lookup (for ToolCredential path)
            prismaMock.organization.findUnique.mockResolvedValue({ id: ORG_B } as any);
            prismaMock.toolCredential.findUnique.mockResolvedValue({
                credentials: { apiKey: "stored-key" },
                isActive: true,
                createdBy: credCreator
            } as any);

            // resolveOrgContext -> findUnique for userIdHint membership
            prismaMock.membership.findUnique.mockResolvedValue({
                userId: credCreator
            } as any);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test", {
                headers: {
                    "x-api-key": "stored-key",
                    "x-organization-slug": "beta-org"
                }
            });
            const result = await authenticateRequest(request as any);

            expect(result).toEqual({ userId: credCreator, organizationId: ORG_B });
        });

        it("falls back to org owner when createdBy user has no membership", async () => {
            mockValidateAccessToken.mockReturnValue(null);
            mockValidateStoredApiKey.mockReturnValue(true);

            // First org lookup (for ToolCredential path)
            prismaMock.organization.findUnique.mockResolvedValue({ id: ORG_B } as any);
            prismaMock.toolCredential.findUnique.mockResolvedValue({
                credentials: { apiKey: "stored-key" },
                isActive: true,
                createdBy: "deleted-user"
            } as any);

            // resolveOrgContext -> findUnique for userIdHint: null (no membership)
            prismaMock.membership.findUnique.mockResolvedValue(null);
            // resolveOrgContext -> findFirst for owner fallback
            prismaMock.membership.findFirst.mockResolvedValue({
                userId: USER_OWNER_B
            } as any);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test", {
                headers: {
                    "x-api-key": "stored-key",
                    "x-organization-slug": "beta-org"
                }
            });
            const result = await authenticateRequest(request as any);

            expect(result).toEqual({ userId: USER_OWNER_B, organizationId: ORG_B });
            expect(prismaMock.membership.findFirst).toHaveBeenCalledWith({
                where: { organizationId: ORG_B, role: "owner" },
                select: { userId: true }
            });
        });

        it("falls back to org owner when createdBy is null", async () => {
            mockValidateAccessToken.mockReturnValue(null);
            mockValidateStoredApiKey.mockReturnValue(true);

            prismaMock.organization.findUnique.mockResolvedValue({ id: ORG_B } as any);
            prismaMock.toolCredential.findUnique.mockResolvedValue({
                credentials: { apiKey: "stored-key" },
                isActive: true,
                createdBy: null
            } as any);

            prismaMock.membership.findFirst.mockResolvedValue({
                userId: USER_OWNER_B
            } as any);

            const { authenticateRequest } = await import("@/lib/api-auth");
            const request = new Request("http://localhost:3001/api/test", {
                headers: {
                    "x-api-key": "stored-key",
                    "x-organization-slug": "beta-org"
                }
            });
            const result = await authenticateRequest(request as any);

            expect(result).toEqual({ userId: USER_OWNER_B, organizationId: ORG_B });
        });
    });
});
