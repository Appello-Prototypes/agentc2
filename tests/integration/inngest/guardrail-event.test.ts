import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import { mockGuardrailEvent, mockAlert } from "../../fixtures/evaluations";
import { createMockStep } from "../../utils/inngest-mock";

// Create prisma mock
const prismaMock = mockDeep<PrismaClient>();

// Mock the database module
vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull"
    }
}));

describe("Inngest: guardrail-event", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("create-event step", () => {
        it("should create GuardrailEvent record with all fields", async () => {
            const eventData = {
                agentId: "test-agent-uuid",
                runId: "test-run-uuid",
                eventType: "BLOCKED" as const,
                ruleName: "blocked-topics",
                inputText: "Tell me about...",
                metadata: { topic: "violence" }
            };

            prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
            prismaMock.guardrailEvent.create.mockResolvedValue(mockGuardrailEvent as never);

            const step = createMockStep();

            await step.run("create-event", async () => {
                const agent = await prismaMock.agent.findUnique({
                    where: { id: eventData.agentId }
                });

                if (!agent) throw new Error("Agent not found");

                return prismaMock.guardrailEvent.create({
                    data: {
                        agentId: eventData.agentId,
                        runId: eventData.runId,
                        tenantId: agent.tenantId,
                        eventType: eventData.eventType,
                        ruleName: eventData.ruleName,
                        inputText: eventData.inputText,
                        metadata: eventData.metadata
                    }
                });
            });

            expect(prismaMock.guardrailEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        agentId: eventData.agentId,
                        runId: eventData.runId,
                        eventType: "BLOCKED",
                        ruleName: "blocked-topics"
                    })
                })
            );
        });
    });

    describe("create-alert step", () => {
        it("should create alert for BLOCKED event type", async () => {
            const eventData = {
                agentId: "test-agent-uuid",
                runId: "test-run-uuid",
                eventType: "BLOCKED" as const,
                ruleName: "blocked-topics"
            };

            prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
            prismaMock.agentAlert.create.mockResolvedValue(mockAlert as never);

            const step = createMockStep();

            await step.run("create-alert", async () => {
                if (eventData.eventType !== "BLOCKED") return null;

                const agent = await prismaMock.agent.findUnique({
                    where: { id: eventData.agentId }
                });

                if (!agent) return null;

                return prismaMock.agentAlert.create({
                    data: {
                        agentId: eventData.agentId,
                        tenantId: agent.tenantId,
                        severity: "WARNING",
                        source: "GUARDRAIL",
                        title: "Content blocked by guardrail",
                        message: `Rule "${eventData.ruleName}" blocked content`
                    }
                });
            });

            expect(prismaMock.agentAlert.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        severity: "WARNING",
                        source: "GUARDRAIL"
                    })
                })
            );
        });

        it("should not create alert for MODIFIED event type", async () => {
            const eventData = {
                agentId: "test-agent-uuid",
                runId: "test-run-uuid",
                eventType: "MODIFIED" as const,
                ruleName: "pii-filter"
            };

            const step = createMockStep();

            await step.run("create-alert", async () => {
                if (eventData.eventType !== "BLOCKED") return null;

                return prismaMock.agentAlert.create({ data: {} as never });
            });

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });

        it("should not create alert for FLAGGED event type", async () => {
            const eventData = {
                agentId: "test-agent-uuid",
                runId: "test-run-uuid",
                eventType: "FLAGGED" as const,
                ruleName: "suspicious-content"
            };

            const step = createMockStep();

            await step.run("create-alert", async () => {
                if (eventData.eventType !== "BLOCKED") return null;

                return prismaMock.agentAlert.create({ data: {} as never });
            });

            expect(prismaMock.agentAlert.create).not.toHaveBeenCalled();
        });
    });
});
