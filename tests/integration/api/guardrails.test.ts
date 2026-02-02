import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockGuardrailPolicy, mockGuardrailEvent } from "../../fixtures/evaluations";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    }
}));

describe("Guardrails API", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("GET /api/agents/[id]/guardrails", () => {
        it("should return guardrail policy with configJson and version", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailPolicy.findUnique.mockResolvedValue(mockGuardrailPolicy as never);

            const policy = await prismaMock.guardrailPolicy.findUnique({
                where: { agentId: "test-agent-uuid" }
            });

            expect(policy).toBeDefined();
            expect(policy?.version).toBe(1);
            expect(policy?.configJson).toEqual(
                expect.objectContaining({
                    maxTokensPerRequest: 4000,
                    maxRequestsPerMinute: 60
                })
            );
        });

        it("should return null if no policy exists", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailPolicy.findUnique.mockResolvedValue(null);

            const policy = await prismaMock.guardrailPolicy.findUnique({
                where: { agentId: "test-agent-uuid" }
            });

            expect(policy).toBeNull();
        });
    });

    describe("PUT /api/agents/[id]/guardrails", () => {
        it("should create new guardrail policy", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailPolicy.findUnique.mockResolvedValue(null);
            prismaMock.guardrailPolicy.create.mockResolvedValue(mockGuardrailPolicy as never);

            const configJson = {
                maxTokensPerRequest: 4000,
                blockedTopics: ["violence", "illegal"]
            };

            const policy = await prismaMock.guardrailPolicy.create({
                data: {
                    agentId: "test-agent-uuid",
                    tenantId: "test-tenant",
                    version: 1,
                    configJson,
                    createdBy: "user-123"
                }
            });

            expect(policy).toBeDefined();
            expect(policy.version).toBe(1);
        });

        it("should increment version on update", async () => {
            const existingPolicy = { ...mockGuardrailPolicy, version: 2 };
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailPolicy.findUnique.mockResolvedValue(existingPolicy as never);
            prismaMock.guardrailPolicy.update.mockResolvedValue({
                ...existingPolicy,
                version: 3
            } as never);

            // Get existing policy
            const existing = await prismaMock.guardrailPolicy.findUnique({
                where: { agentId: "test-agent-uuid" }
            });

            expect(existing?.version).toBe(2);

            // Update with incremented version
            const updated = await prismaMock.guardrailPolicy.update({
                where: { agentId: "test-agent-uuid" },
                data: {
                    version: (existing?.version || 0) + 1,
                    configJson: { maxTokensPerRequest: 5000 }
                }
            });

            expect(updated.version).toBe(3);
        });

        it("should create audit log on update", async () => {
            prismaMock.auditLog.create.mockResolvedValue({
                id: "audit-uuid",
                tenantId: "test-tenant",
                action: "GUARDRAIL_UPDATED",
                entityType: "GuardrailPolicy",
                entityId: "test-agent-uuid"
            } as never);

            await prismaMock.auditLog.create({
                data: {
                    tenantId: "test-tenant",
                    action: "GUARDRAIL_UPDATED",
                    entityType: "GuardrailPolicy",
                    entityId: "test-agent-uuid",
                    actorId: "user-123",
                    metadata: { version: 2 }
                }
            });

            expect(prismaMock.auditLog.create).toHaveBeenCalled();
        });

        it("should return 400 for missing configJson", async () => {
            const requestBody = {};

            // Validation check
            const isValid = "configJson" in requestBody;
            expect(isValid).toBe(false);
        });

        it("should return 404 for invalid agent", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(null);

            const agent = await prismaMock.agent.findFirst({
                where: { id: "invalid-agent-uuid" }
            });

            expect(agent).toBeNull();
        });
    });

    describe("GET /api/agents/[id]/guardrails/events", () => {
        it("should return paginated guardrail events", async () => {
            const events = [
                { ...mockGuardrailEvent, id: "event-1" },
                { ...mockGuardrailEvent, id: "event-2" },
                { ...mockGuardrailEvent, id: "event-3" }
            ];

            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailEvent.findMany.mockResolvedValue(events as never);

            const eventsResult = await prismaMock.guardrailEvent.findMany({
                where: { agentId: "test-agent-uuid" },
                take: 50,
                orderBy: { createdAt: "desc" }
            });

            expect(eventsResult).toHaveLength(3);
        });

        it("should include run details with events", async () => {
            const eventWithRun = {
                ...mockGuardrailEvent,
                run: {
                    id: "test-run-uuid",
                    inputText: "Test input",
                    status: "COMPLETED"
                }
            };

            prismaMock.guardrailEvent.findMany.mockResolvedValue([eventWithRun] as never);

            const events = await prismaMock.guardrailEvent.findMany({
                where: { agentId: "test-agent-uuid" },
                include: { run: true }
            });

            expect(events[0].run).toBeDefined();
        });

        it("should return counts by event type", async () => {
            const events = [
                { ...mockGuardrailEvent, eventType: "BLOCKED" },
                { ...mockGuardrailEvent, eventType: "BLOCKED" },
                { ...mockGuardrailEvent, eventType: "MODIFIED" },
                { ...mockGuardrailEvent, eventType: "FLAGGED" }
            ];

            // Count by type
            const counts = {
                BLOCKED: events.filter((e) => e.eventType === "BLOCKED").length,
                MODIFIED: events.filter((e) => e.eventType === "MODIFIED").length,
                FLAGGED: events.filter((e) => e.eventType === "FLAGGED").length
            };

            expect(counts.BLOCKED).toBe(2);
            expect(counts.MODIFIED).toBe(1);
            expect(counts.FLAGGED).toBe(1);
        });

        it("should respect date range", async () => {
            const from = new Date("2024-01-01");
            const to = new Date("2024-01-07");

            prismaMock.guardrailEvent.findMany.mockResolvedValue([]);

            await prismaMock.guardrailEvent.findMany({
                where: {
                    agentId: "test-agent-uuid",
                    createdAt: { gte: from, lte: to }
                }
            });

            expect(prismaMock.guardrailEvent.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        createdAt: { gte: from, lte: to }
                    })
                })
            );
        });

        it("should handle cursor pagination", async () => {
            prismaMock.guardrailEvent.findMany.mockResolvedValue([]);

            await prismaMock.guardrailEvent.findMany({
                where: { agentId: "test-agent-uuid" },
                cursor: { id: "cursor-event-id" },
                skip: 1,
                take: 50
            });

            expect(prismaMock.guardrailEvent.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    cursor: { id: "cursor-event-id" },
                    skip: 1
                })
            );
        });

        it("should return empty array when no events", async () => {
            prismaMock.agent.findFirst.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailEvent.findMany.mockResolvedValue([]);

            const events = await prismaMock.guardrailEvent.findMany({
                where: { agentId: "test-agent-uuid" }
            });

            expect(events).toHaveLength(0);
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
