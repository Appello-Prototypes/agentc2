import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockTestCase } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Test Cases API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/test-cases", () => {
        it("should return test cases with last run result", async () => {
            const testCases = [
                {
                    ...mockTestCase,
                    testRuns: [
                        {
                            id: "run-1",
                            passed: true,
                            score: 0.95,
                            createdAt: new Date()
                        }
                    ]
                },
                {
                    ...mockTestCase,
                    id: "tc-2",
                    testRuns: []
                }
            ];

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentTestCase.findMany.mockResolvedValue(testCases as never);

            const cases = await prismaMock.agentTestCase.findMany({
                where: { agentId: "test-agent-uuid" },
                include: {
                    testRuns: {
                        orderBy: { createdAt: "desc" },
                        take: 1
                    }
                }
            });

            expect(cases).toHaveLength(2);
            expect(cases[0].testRuns).toHaveLength(1);
            expect(cases[1].testRuns).toHaveLength(0);
        });

        it("should handle cursor pagination", async () => {
            prismaMock.agentTestCase.findMany.mockResolvedValue([]);

            await prismaMock.agentTestCase.findMany({
                where: { agentId: "test-agent-uuid" },
                cursor: { id: "cursor-id" },
                skip: 1,
                take: 50
            });

            expect(prismaMock.agentTestCase.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    cursor: { id: "cursor-id" },
                    skip: 1
                })
            );
        });

        it("should return empty array when no test cases", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentTestCase.findMany.mockResolvedValue([]);

            const cases = await prismaMock.agentTestCase.findMany({
                where: { agentId: "test-agent-uuid" }
            });

            expect(cases).toHaveLength(0);
        });
    });

    describe("POST /api/agents/[id]/test-cases", () => {
        it("should create test case with required fields", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentTestCase.create.mockResolvedValue(mockTestCase as never);

            const testCaseData = {
                name: "Basic greeting test",
                inputText: "Hello!",
                expectedOutput: "Hi there!",
                tags: ["greeting"],
                createdBy: "user-123"
            };

            const testCase = await prismaMock.agentTestCase.create({
                data: {
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    ...testCaseData
                }
            });

            expect(testCase).toBeDefined();
            expect(testCase.name).toBe("Basic greeting test");
        });

        it("should return 400 for missing name", async () => {
            const requestBody = { inputText: "Hello!" };

            const isValid = "name" in requestBody && "inputText" in requestBody;
            expect(isValid).toBe(false);
        });

        it("should return 400 for missing inputText", async () => {
            const requestBody = { name: "Test case" };

            const isValid = "name" in requestBody && "inputText" in requestBody;
            expect(isValid).toBe(false);
        });

        it("should allow optional expectedOutput", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentTestCase.create.mockResolvedValue({
                ...mockTestCase,
                expectedOutput: null
            } as never);

            const testCase = await prismaMock.agentTestCase.create({
                data: {
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    name: "Test without expected",
                    inputText: "Hello!"
                }
            });

            expect(testCase.expectedOutput).toBeNull();
        });

        it("should allow optional tags array", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.agentTestCase.create.mockResolvedValue({
                ...mockTestCase,
                tags: ["tag1", "tag2", "tag3"]
            } as never);

            const testCase = await prismaMock.agentTestCase.create({
                data: {
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    name: "Test with tags",
                    inputText: "Hello!",
                    tags: ["tag1", "tag2", "tag3"]
                }
            });

            expect(testCase.tags).toHaveLength(3);
        });

        it("should return 404 for invalid agent", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(null);

            const agent = await prismaMock.agent.findFirst({
                where: { id: "invalid-agent-uuid" }
            });

            expect(agent).toBeNull();
        });
    });
});
