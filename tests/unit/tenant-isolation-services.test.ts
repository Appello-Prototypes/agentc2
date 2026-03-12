import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock
}));

const ORG_A = "org-A";
const ORG_B = "org-B";

describe("Service-Layer Tenant Isolation", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    // ─── bindWorkspaceContext ───────────────────────────────────────

    describe("bindWorkspaceContext", () => {
        it("injects organizationId into ORG_SCOPED tool inputs", async () => {
            const { bindWorkspaceContext } = await import("@repo/agentc2/tools/sandbox-tools");

            const executeSpy = vi.fn().mockResolvedValue("ok");
            const tool = {
                id: "rag-query",
                execute: executeSpy
            };

            const bound = bindWorkspaceContext(tool, {
                organizationId: ORG_A,
                agentId: "agent-1"
            });
            await bound.execute({ query: "test" });

            expect(executeSpy).toHaveBeenCalledWith({
                query: "test",
                organizationId: ORG_A
            });
        });

        it("injects both organizationId and agentId into WORKSPACE tool inputs", async () => {
            const { bindWorkspaceContext } = await import("@repo/agentc2/tools/sandbox-tools");

            const executeSpy = vi.fn().mockResolvedValue("ok");
            const tool = {
                id: "execute-code",
                execute: executeSpy
            };

            const bound = bindWorkspaceContext(tool, {
                organizationId: ORG_A,
                agentId: "agent-1"
            });
            await bound.execute({ code: "console.log(1)" });

            expect(executeSpy).toHaveBeenCalledWith({
                code: "console.log(1)",
                organizationId: ORG_A,
                agentId: "agent-1"
            });
        });

        it("does not override explicitly provided organizationId", async () => {
            const { bindWorkspaceContext } = await import("@repo/agentc2/tools/sandbox-tools");

            const executeSpy = vi.fn().mockResolvedValue("ok");
            const tool = {
                id: "rag-query",
                execute: executeSpy
            };

            const bound = bindWorkspaceContext(tool, {
                organizationId: ORG_A,
                agentId: "agent-1"
            });
            await bound.execute({ query: "test", organizationId: ORG_B });

            expect(executeSpy).toHaveBeenCalledWith(
                expect.objectContaining({ organizationId: ORG_B })
            );
        });

        it("returns non-scoped tools unchanged", async () => {
            const { bindWorkspaceContext } = await import("@repo/agentc2/tools/sandbox-tools");

            const executeSpy = vi.fn().mockResolvedValue("ok");
            const tool = {
                id: "unknown-tool",
                execute: executeSpy
            };

            const bound = bindWorkspaceContext(tool, {
                organizationId: ORG_A,
                agentId: "agent-1"
            });

            expect(bound).toBe(tool);
        });

        it("handles tool with no id gracefully", async () => {
            const { bindWorkspaceContext } = await import("@repo/agentc2/tools/sandbox-tools");

            const tool = { execute: vi.fn() };
            const bound = bindWorkspaceContext(tool, {
                organizationId: ORG_A,
                agentId: "agent-1"
            });

            expect(bound).toBe(tool);
        });
    });

    // ─── recommendSkills ────────────────────────────────────────────

    describe("recommendSkills", () => {
        it("scopes skill query to organization when organizationId is provided", async () => {
            prismaMock.skill.findMany.mockResolvedValue([]);

            const { recommendSkills } = await import("@repo/agentc2/skills/recommender");
            await recommendSkills("Help users with tasks", {
                organizationId: ORG_A
            });

            expect(prismaMock.skill.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        organizationId: ORG_A
                    }
                })
            );
        });

        it("queries all skills when no organizationId is provided", async () => {
            prismaMock.skill.findMany.mockResolvedValue([]);

            const { recommendSkills } = await import("@repo/agentc2/skills/recommender");
            await recommendSkills("Help users with tasks");

            expect(prismaMock.skill.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {}
                })
            );
        });
    });

    // ─── getDocument ────────────────────────────────────────────────

    describe("getDocument org scoping", () => {
        it("includes organizationId in where clause when provided", async () => {
            prismaMock.document.findFirst.mockResolvedValue(null);

            const { getDocument } = await import("@repo/agentc2/documents/service");

            await getDocument("doc-slug", ORG_A).catch(() => {});

            expect(prismaMock.document.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: ORG_A
                    })
                })
            );
        });

        it("does not filter by org when organizationId is omitted", async () => {
            prismaMock.document.findFirst.mockResolvedValue({
                id: "doc-1",
                slug: "doc-slug",
                title: "Test",
                content: "content",
                organizationId: ORG_B
            } as any);

            const { getDocument } = await import("@repo/agentc2/documents/service");

            const result = await getDocument("doc-slug");
            expect(result).toBeTruthy();

            const callArgs = prismaMock.document.findFirst.mock.calls[0]![0] as any;
            expect(callArgs.where).not.toHaveProperty("organizationId");
        });
    });

    // ─── listDocuments ──────────────────────────────────────────────

    describe("listDocuments org scoping", () => {
        it("includes organizationId filter when provided", async () => {
            prismaMock.document.findMany.mockResolvedValue([]);
            prismaMock.document.count.mockResolvedValue(0);

            const { listDocuments } = await import("@repo/agentc2/documents/service");

            await listDocuments({ organizationId: ORG_A });

            expect(prismaMock.document.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        organizationId: ORG_A
                    })
                })
            );
        });
    });
});
