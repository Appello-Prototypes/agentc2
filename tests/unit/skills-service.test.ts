import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockSkill, mockSystemSkill, mockSkillVersion } from "../fixtures/skills";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: { InputJsonValue: {} }
}));

// Import after mocking
const { createSkill, updateSkill, deleteSkill, getSkill, listSkills, forkSkill } =
    await import("@repo/mastra");

describe("Skill Service", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("createSkill", () => {
        it("should create a skill with all fields", async () => {
            prismaMock.skill.create.mockResolvedValue(mockSkill as never);

            const result = await createSkill({
                slug: "test-skill",
                name: "Test Skill",
                instructions: "Test instructions",
                description: "A description",
                category: "utility",
                tags: ["test"]
            });

            expect(prismaMock.skill.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    slug: "test-skill",
                    name: "Test Skill",
                    instructions: "Test instructions"
                })
            });
            expect(result).toEqual(mockSkill);
        });

        it("should default type to USER", async () => {
            prismaMock.skill.create.mockResolvedValue(mockSkill as never);

            await createSkill({
                slug: "new-skill",
                name: "New",
                instructions: "Instructions"
            });

            expect(prismaMock.skill.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    type: "USER"
                })
            });
        });

        it("should default tags to empty array", async () => {
            prismaMock.skill.create.mockResolvedValue(mockSkill as never);

            await createSkill({
                slug: "new-skill",
                name: "New",
                instructions: "Instructions"
            });

            expect(prismaMock.skill.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    tags: []
                })
            });
        });
    });

    describe("updateSkill", () => {
        it("should update a skill field", async () => {
            prismaMock.skill.findFirst.mockResolvedValue(mockSkill as never);
            prismaMock.skill.findUniqueOrThrow.mockResolvedValue(mockSkill as never);
            prismaMock.skill.update.mockResolvedValue({ ...mockSkill, name: "Updated" } as never);

            const result = await updateSkill("test-skill", { name: "Updated" });

            expect(prismaMock.skill.update).toHaveBeenCalled();
            expect(result.name).toBe("Updated");
        });

        it("should create a version when instructions change", async () => {
            prismaMock.skill.findFirst.mockResolvedValue(mockSkill as never);
            prismaMock.skill.findUniqueOrThrow.mockResolvedValue(mockSkill as never);
            prismaMock.skillDocument.findMany.mockResolvedValue([] as never);
            prismaMock.skillTool.findMany.mockResolvedValue([] as never);
            prismaMock.skillVersion.create.mockResolvedValue(mockSkillVersion as never);
            prismaMock.skill.update.mockResolvedValue({
                ...mockSkill,
                instructions: "New instructions",
                version: 2
            } as never);

            await updateSkill("test-skill", { instructions: "New instructions" });

            expect(prismaMock.skillVersion.create).toHaveBeenCalled();
        });

        it("should NOT create a version when only name changes", async () => {
            prismaMock.skill.findFirst.mockResolvedValue(mockSkill as never);
            prismaMock.skill.findUniqueOrThrow.mockResolvedValue(mockSkill as never);
            prismaMock.skill.update.mockResolvedValue({ ...mockSkill, name: "New Name" } as never);

            await updateSkill("test-skill", { name: "New Name" });

            expect(prismaMock.skillVersion.create).not.toHaveBeenCalled();
        });
    });

    describe("deleteSkill", () => {
        it("should delete a skill by slug", async () => {
            prismaMock.skill.findFirst.mockResolvedValue(mockSkill as never);
            prismaMock.skill.delete.mockResolvedValue(mockSkill as never);

            await deleteSkill("test-skill");

            expect(prismaMock.skill.delete).toHaveBeenCalledWith({
                where: { id: mockSkill.id }
            });
        });
    });

    describe("getSkill", () => {
        it("should return skill with related data", async () => {
            prismaMock.skill.findFirst.mockResolvedValue(mockSkill as never);

            const result = await getSkill("test-skill");

            expect(prismaMock.skill.findFirst).toHaveBeenCalledWith({
                where: {
                    OR: [{ id: "test-skill" }, { slug: "test-skill" }]
                },
                include: expect.objectContaining({
                    documents: expect.anything(),
                    tools: true,
                    agents: expect.anything()
                })
            });
            expect(result).toEqual(mockSkill);
        });

        it("should return null for non-existent skill", async () => {
            prismaMock.skill.findFirst.mockResolvedValue(null as never);

            const result = await getSkill("non-existent");
            expect(result).toBeNull();
        });
    });

    describe("listSkills", () => {
        it("should list skills with default pagination", async () => {
            prismaMock.skill.findMany.mockResolvedValue([mockSkill] as never);
            prismaMock.skill.count.mockResolvedValue(1);

            const result = await listSkills();

            expect(result.skills).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(prismaMock.skill.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0,
                    take: 50
                })
            );
        });

        it("should filter by category", async () => {
            prismaMock.skill.findMany.mockResolvedValue([mockSystemSkill] as never);
            prismaMock.skill.count.mockResolvedValue(1);

            await listSkills({ category: "builder" });

            expect(prismaMock.skill.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ category: "builder" })
                })
            );
        });

        it("should filter by type", async () => {
            prismaMock.skill.findMany.mockResolvedValue([] as never);
            prismaMock.skill.count.mockResolvedValue(0);

            await listSkills({ type: "SYSTEM" });

            expect(prismaMock.skill.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ type: "SYSTEM" })
                })
            );
        });
    });

    describe("forkSkill", () => {
        it("should create a USER copy of a SYSTEM skill", async () => {
            const sourceWithRelations = {
                ...mockSystemSkill,
                tools: [{ toolId: "agent-create" }, { toolId: "agent-read" }],
                documents: []
            };
            prismaMock.skill.findFirst.mockResolvedValue(sourceWithRelations as never);
            prismaMock.skill.findUniqueOrThrow.mockResolvedValue(sourceWithRelations as never);

            const forkedSkill = {
                ...mockSkill,
                id: "forked-uuid",
                slug: "platform-agent-management-custom",
                name: "Agent Management (Custom)",
                type: "USER"
            };
            prismaMock.skill.create.mockResolvedValue(forkedSkill as never);
            prismaMock.skillTool.createMany.mockResolvedValue({ count: 2 } as never);

            const result = await forkSkill("platform-agent-management");

            expect(prismaMock.skill.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    slug: "platform-agent-management-custom",
                    name: "Agent Management (Custom)",
                    type: "USER"
                })
            });
            expect(prismaMock.skillTool.createMany).toHaveBeenCalled();
            expect(result.slug).toBe("platform-agent-management-custom");
        });

        it("should use custom slug and name if provided", async () => {
            const sourceWithRelations = {
                ...mockSystemSkill,
                tools: [],
                documents: []
            };
            prismaMock.skill.findFirst.mockResolvedValue(sourceWithRelations as never);
            prismaMock.skill.findUniqueOrThrow.mockResolvedValue(sourceWithRelations as never);

            const forkedSkill = {
                ...mockSkill,
                id: "forked-uuid",
                slug: "my-agents",
                name: "My Agent Manager"
            };
            prismaMock.skill.create.mockResolvedValue(forkedSkill as never);

            await forkSkill("platform-agent-management", {
                slug: "my-agents",
                name: "My Agent Manager"
            });

            expect(prismaMock.skill.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    slug: "my-agents",
                    name: "My Agent Manager"
                })
            });
        });
    });
});
