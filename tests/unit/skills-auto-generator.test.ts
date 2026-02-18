import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: { InputJsonValue: {} }
}));

const { generateSkillForMcpServer, mcpSkillExists, getMcpSkillSlug } = await import("@repo/mastra");

describe("Skill Auto-Generator", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("generateSkillForMcpServer", () => {
        it("should create skill for known server (hubspot)", async () => {
            const mockCreated = {
                id: "skill-id",
                slug: "mcp-crm-hubspot",
                name: "HubSpot CRM",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01")
            };
            prismaMock.skill.findFirst.mockResolvedValue(null);
            prismaMock.skill.create.mockResolvedValue(mockCreated as never);
            prismaMock.skillTool.deleteMany.mockResolvedValue({ count: 0 } as never);
            prismaMock.skillTool.createMany.mockResolvedValue({ count: 2 } as never);

            const result = await generateSkillForMcpServer("hubspot", [
                { name: "hubspot_get-contacts", description: "Get contacts" },
                { name: "hubspot_create-contact", description: "Create a contact" }
            ]);

            expect(result.slug).toBe("mcp-crm-hubspot");
            expect(result.toolCount).toBe(2);
            expect(prismaMock.skill.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ slug: "mcp-crm-hubspot" })
                })
            );
        });

        it("should generate generic slug for unknown server", async () => {
            const mockCreated = {
                id: "skill-id",
                slug: "mcp-custom-newserver",
                name: "newserver Integration",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01")
            };
            prismaMock.skill.findFirst.mockResolvedValue(null);
            prismaMock.skill.create.mockResolvedValue(mockCreated as never);
            prismaMock.skillTool.deleteMany.mockResolvedValue({ count: 0 } as never);
            prismaMock.skillTool.createMany.mockResolvedValue({ count: 1 } as never);

            const result = await generateSkillForMcpServer("newserver", [
                { name: "newserver_do-thing", description: "Do a thing" }
            ]);

            expect(result.slug).toBe("mcp-custom-newserver");
            expect(result.toolCount).toBe(1);
        });

        it("should handle empty tool list", async () => {
            const mockCreated = {
                id: "skill-id",
                slug: "mcp-crm-hubspot",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01")
            };
            prismaMock.skill.findFirst.mockResolvedValue(null);
            prismaMock.skill.create.mockResolvedValue(mockCreated as never);
            prismaMock.skillTool.deleteMany.mockResolvedValue({ count: 0 } as never);

            const result = await generateSkillForMcpServer("hubspot", []);

            expect(result.toolCount).toBe(0);
            expect(prismaMock.skillTool.createMany).not.toHaveBeenCalled();
        });
    });

    describe("mcpSkillExists", () => {
        it("should return true when skill exists", async () => {
            prismaMock.skill.count.mockResolvedValue(1);

            const result = await mcpSkillExists("hubspot");

            expect(result).toBe(true);
            expect(prismaMock.skill.count).toHaveBeenCalledWith({
                where: { slug: "mcp-crm-hubspot" }
            });
        });

        it("should return false when skill does not exist", async () => {
            prismaMock.skill.count.mockResolvedValue(0);

            const result = await mcpSkillExists("unknown");

            expect(result).toBe(false);
        });
    });

    describe("getMcpSkillSlug", () => {
        it("should return mapped slug for known server", () => {
            expect(getMcpSkillSlug("hubspot")).toBe("mcp-crm-hubspot");
            expect(getMcpSkillSlug("jira")).toBe("mcp-project-jira");
            expect(getMcpSkillSlug("github")).toBe("mcp-code-github");
        });

        it("should return generated slug for unknown server", () => {
            expect(getMcpSkillSlug("newserver")).toBe("mcp-custom-newserver");
        });
    });
});
