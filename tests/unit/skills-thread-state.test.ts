import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockThreadSkillState } from "../fixtures/skills";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: { InputJsonValue: {} }
}));

const {
    getThreadSkillState,
    addThreadSkillActivations,
    setThreadSkillState,
    clearThreadSkillState
} = await import("@repo/agentc2");

describe("Thread Skill State", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("getThreadSkillState", () => {
        it("should return skill slugs for existing thread", async () => {
            prismaMock.threadSkillState.findUnique.mockResolvedValue(mockThreadSkillState as never);

            const result = await getThreadSkillState("thread-123");

            expect(result).toEqual(["mcp-crm-hubspot", "core-utilities"]);
        });

        it("should return empty array for non-existent thread", async () => {
            prismaMock.threadSkillState.findUnique.mockResolvedValue(null as never);

            const result = await getThreadSkillState("non-existent");

            expect(result).toEqual([]);
        });
    });

    describe("addThreadSkillActivations", () => {
        it("should add new activations to empty thread", async () => {
            prismaMock.threadSkillState.findUnique.mockResolvedValue(null as never);
            prismaMock.threadSkillState.upsert.mockResolvedValue({
                ...mockThreadSkillState,
                skillSlugs: ["mcp-crm-hubspot"]
            } as never);

            const result = await addThreadSkillActivations("thread-new", "agent-1", [
                "mcp-crm-hubspot"
            ]);

            expect(result).toContain("mcp-crm-hubspot");
            expect(prismaMock.threadSkillState.upsert).toHaveBeenCalled();
        });

        it("should merge with existing activations (no duplicates)", async () => {
            prismaMock.threadSkillState.findUnique.mockResolvedValue({
                ...mockThreadSkillState,
                skillSlugs: ["core-utilities"]
            } as never);
            prismaMock.threadSkillState.upsert.mockResolvedValue({
                ...mockThreadSkillState,
                skillSlugs: ["core-utilities", "mcp-crm-hubspot"]
            } as never);

            const result = await addThreadSkillActivations(
                "thread-123",
                "agent-1",
                ["mcp-crm-hubspot", "core-utilities"] // core-utilities is already there
            );

            // Should have unique values
            expect(new Set(result).size).toBe(result.length);
            expect(result).toContain("core-utilities");
            expect(result).toContain("mcp-crm-hubspot");
        });
    });

    describe("setThreadSkillState", () => {
        it("should replace full state", async () => {
            prismaMock.threadSkillState.upsert.mockResolvedValue(mockThreadSkillState as never);

            await setThreadSkillState("thread-123", "agent-1", ["skill-a", "skill-b"]);

            expect(prismaMock.threadSkillState.upsert).toHaveBeenCalledWith({
                where: { threadId: "thread-123" },
                update: { skillSlugs: ["skill-a", "skill-b"] },
                create: {
                    threadId: "thread-123",
                    agentId: "agent-1",
                    skillSlugs: ["skill-a", "skill-b"]
                }
            });
        });
    });

    describe("clearThreadSkillState", () => {
        it("should delete state for thread", async () => {
            prismaMock.threadSkillState.deleteMany.mockResolvedValue({ count: 1 } as never);

            await clearThreadSkillState("thread-123");

            expect(prismaMock.threadSkillState.deleteMany).toHaveBeenCalledWith({
                where: { threadId: "thread-123" }
            });
        });

        it("should handle non-existent thread gracefully", async () => {
            prismaMock.threadSkillState.deleteMany.mockResolvedValue({ count: 0 } as never);

            await clearThreadSkillState("non-existent");

            expect(prismaMock.threadSkillState.deleteMany).toHaveBeenCalled();
        });
    });
});
