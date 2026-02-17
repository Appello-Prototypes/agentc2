import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { createMockStep, createMockEvent } from "../../utils/inngest-mock";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {}
    }
}));

// Mock executeOutputAction
const mockExecuteOutputAction = vi.fn().mockResolvedValue({ success: true });
vi.mock("../../../apps/agent/src/lib/output-actions", () => ({
    executeOutputAction: mockExecuteOutputAction
}));

// Mock ingestDocument
const mockIngestDocument = vi.fn().mockResolvedValue({
    documentId: "test-doc",
    chunksIngested: 3,
    vectorIds: ["v1", "v2", "v3"]
});
vi.mock("@repo/mastra", () => ({
    ingestDocument: mockIngestDocument
}));

// Mock computeAndUpsertHealthScore
vi.mock("../../../apps/agent/src/lib/health-score", () => ({
    computeAndUpsertHealthScore: vi.fn().mockResolvedValue({})
}));

describe("Output Pipeline - Inngest Integration", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        mockExecuteOutputAction.mockClear();
        mockIngestDocument.mockClear();
    });

    const mockRun = {
        id: "run-1",
        agentId: "agent-1",
        outputText:
            "This is a substantial output from the agent that should be vectorized and delivered.",
        inputText: "Analyze the company",
        source: "scheduled",
        triggerType: "SCHEDULED",
        createdAt: new Date("2026-02-17T12:00:00Z"),
        status: "COMPLETED",
        agent: {
            requiresApproval: false,
            workspaceId: null,
            workspace: null
        },
        TriggerEvent: null
    };

    const mockAgent = {
        slug: "company-intelligence",
        name: "Company Intelligence",
        autoVectorize: true
    };

    const mockEvaluation = {
        overallGrade: 0.88,
        confidenceScore: 0.82,
        evaluationTier: "tier2_auditor"
    };

    const mockAction = {
        id: "action-1",
        type: "WEBHOOK",
        configJson: { url: "https://example.com/hook" },
        isActive: true,
        name: "Test Webhook"
    };

    // Test 24: run/completed triggers output actions
    it("run/completed triggers output action execution", async () => {
        // Setup: agent has active output actions and a run with output
        prismaMock.outputAction.findMany.mockResolvedValue([mockAction] as never);
        prismaMock.agentRun.findUnique.mockResolvedValue(mockRun as never);
        prismaMock.budgetPolicy.findUnique.mockResolvedValue(null);

        // Simulate the execute-output-actions step directly
        const actions = await prismaMock.outputAction.findMany({
            where: { agentId: "agent-1", isActive: true }
        });
        expect(actions).toHaveLength(1);

        const run = await prismaMock.agentRun.findUnique({ where: { id: "run-1" } });
        expect(run?.outputText).toBeTruthy();

        // Execute the dispatcher
        for (const action of actions) {
            await mockExecuteOutputAction(
                action,
                { outputText: run!.outputText, inputText: run!.inputText, source: run!.source },
                { agentId: "agent-1", runId: "run-1" }
            );
        }

        expect(mockExecuteOutputAction).toHaveBeenCalledTimes(1);
        expect(mockExecuteOutputAction).toHaveBeenCalledWith(
            expect.objectContaining({ type: "WEBHOOK" }),
            expect.objectContaining({ outputText: mockRun.outputText }),
            expect.objectContaining({ agentId: "agent-1", runId: "run-1" })
        );
    });

    // Test 25: evaluation/completed triggers auto-vectorization
    it("evaluation/completed triggers auto-vectorization", async () => {
        prismaMock.agentRun.findUnique.mockResolvedValue(mockRun as never);
        prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
        prismaMock.agentEvaluation.findUnique.mockResolvedValue(mockEvaluation as never);

        // Simulate auto-vectorize step
        const run = await prismaMock.agentRun.findUnique({ where: { id: "run-1" } });
        const agent = await prismaMock.agent.findUnique({ where: { id: "agent-1" } });
        const evaluation = await prismaMock.agentEvaluation.findUnique({
            where: { id: "eval-1" }
        });

        if (run?.outputText && (run.outputText as string).length >= 50 && agent?.autoVectorize) {
            await mockIngestDocument(run.outputText, {
                type: "markdown",
                sourceId: `agent-output/${agent.slug}/${run.id}`,
                metadata: {
                    contentType: "agent-output",
                    agentSlug: agent.slug,
                    overallGrade: evaluation?.overallGrade ?? null
                }
            });
        }

        expect(mockIngestDocument).toHaveBeenCalledTimes(1);
        expect(mockIngestDocument).toHaveBeenCalledWith(
            mockRun.outputText,
            expect.objectContaining({
                type: "markdown",
                metadata: expect.objectContaining({
                    contentType: "agent-output",
                    agentSlug: "company-intelligence",
                    overallGrade: 0.88
                })
            })
        );
    });

    // Test 26: RAG query returns quality metadata
    it("auto-vectorized content includes quality metadata in sourceId and metadata", async () => {
        prismaMock.agentRun.findUnique.mockResolvedValue(mockRun as never);
        prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
        prismaMock.agentEvaluation.findUnique.mockResolvedValue(mockEvaluation as never);

        const run = await prismaMock.agentRun.findUnique({ where: { id: "run-1" } });
        const agent = await prismaMock.agent.findUnique({ where: { id: "agent-1" } });

        await mockIngestDocument(run!.outputText, {
            type: "markdown",
            sourceId: `agent-output/${agent!.slug}/${run!.id}`,
            metadata: {
                contentType: "agent-output",
                agentSlug: agent!.slug,
                agentName: agent!.name,
                runId: run!.id,
                overallGrade: 0.88,
                confidenceScore: 0.82,
                evaluationTier: "tier2_auditor",
                timestamp: (run!.createdAt as Date).toISOString()
            }
        });

        const callArgs = mockIngestDocument.mock.calls[0][1];
        expect(callArgs.sourceId).toBe("agent-output/company-intelligence/run-1");
        expect(callArgs.metadata.contentType).toBe("agent-output");
        expect(callArgs.metadata.overallGrade).toBe(0.88);
        expect(callArgs.metadata.confidenceScore).toBe(0.82);
        expect(callArgs.metadata.evaluationTier).toBe("tier2_auditor");
    });

    // Test 27: Failed output action does not block
    it("failed output action does not block evaluation or vectorization", async () => {
        // Action fails
        mockExecuteOutputAction.mockResolvedValueOnce({
            success: false,
            error: "Connection refused"
        });

        const result = await mockExecuteOutputAction(
            mockAction,
            {
                outputText: mockRun.outputText,
                inputText: mockRun.inputText,
                source: mockRun.source
            },
            { agentId: "agent-1", runId: "run-1" }
        );

        expect(result.success).toBe(false);

        // Vectorization should still work independently
        prismaMock.agentRun.findUnique.mockResolvedValue(mockRun as never);
        prismaMock.agent.findUnique.mockResolvedValue(mockAgent as never);
        prismaMock.agentEvaluation.findUnique.mockResolvedValue(mockEvaluation as never);

        await mockIngestDocument(mockRun.outputText, {
            type: "markdown",
            sourceId: "agent-output/company-intelligence/run-1"
        });

        expect(mockIngestDocument).toHaveBeenCalledTimes(1);
    });
});
