import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock, mockPrismaModule } from "../../utils/db-mock";

// Mock prisma before importing anything that uses it
mockPrismaModule();

// Mock @repo/agentc2 ingestDocument
const mockIngestDocument = vi.fn().mockResolvedValue({
    documentId: "test-doc",
    chunksIngested: 3,
    vectorIds: ["v1", "v2", "v3"]
});
vi.mock("@repo/agentc2", () => ({
    ingestDocument: mockIngestDocument
}));

describe("Auto-Vectorize Output", () => {
    beforeEach(() => {
        resetPrismaMock();
        mockIngestDocument.mockClear();
    });

    const makeRun = (overrides: Record<string, unknown> = {}) => ({
        id: "run-1",
        outputText:
            "A meaningful output that is longer than fifty characters for testing purposes.",
        source: "scheduled",
        triggerType: "SCHEDULED",
        agentId: "agent-1",
        createdAt: new Date("2026-02-17T12:00:00Z"),
        ...overrides
    });

    const makeAgent = (overrides: Record<string, unknown> = {}) => ({
        slug: "company-intelligence",
        name: "Company Intelligence",
        autoVectorize: true,
        ...overrides
    });

    const makeEvaluation = (overrides: Record<string, unknown> = {}) => ({
        overallGrade: 0.91,
        confidenceScore: 0.87,
        evaluationTier: "tier2_auditor",
        ...overrides
    });

    // Helper to simulate what the Inngest step does
    async function simulateAutoVectorize(
        runData: ReturnType<typeof makeRun> | null,
        agentData: ReturnType<typeof makeAgent> | null,
        evaluationData: ReturnType<typeof makeEvaluation> | null
    ) {
        prismaMock.agentRun.findUnique.mockResolvedValue(runData as never);
        prismaMock.agent.findUnique.mockResolvedValue(agentData as never);
        prismaMock.agentEvaluation.findUnique.mockResolvedValue(evaluationData as never);

        const run = await prismaMock.agentRun.findUnique({ where: { id: "run-1" } });
        if (!run?.outputText || (run.outputText as string).length < 50) return;

        const agent = await prismaMock.agent.findUnique({ where: { id: "agent-1" } });
        if (!agent?.autoVectorize) return;

        const evaluation = await prismaMock.agentEvaluation.findUnique({
            where: { id: "eval-1" }
        });

        const { ingestDocument } = await import("@repo/agentc2");
        await ingestDocument(run.outputText as string, {
            type: "markdown",
            sourceId: `agent-output/${agent.slug}/${run.id}`,
            sourceName: `${agent.name} - ${(run.createdAt as Date).toISOString().split("T")[0]}`,
            metadata: {
                contentType: "agent-output",
                agentSlug: agent.slug,
                agentName: agent.name,
                runId: run.id,
                source: run.source || "unknown",
                triggerType: run.triggerType,
                overallGrade: evaluation?.overallGrade ?? null,
                confidenceScore: evaluation?.confidenceScore ?? null,
                evaluationTier: evaluation?.evaluationTier ?? null,
                timestamp: (run.createdAt as Date).toISOString()
            }
        });
    }

    // Test 9: Calls ingestDocument with outputText
    it("calls ingestDocument with outputText as content", async () => {
        await simulateAutoVectorize(makeRun(), makeAgent(), makeEvaluation());

        expect(mockIngestDocument).toHaveBeenCalledTimes(1);
        expect(mockIngestDocument.mock.calls[0][0]).toContain("meaningful output");
    });

    // Test 10: Attaches eval scores to metadata
    it("attaches overallGrade, confidenceScore, evaluationTier to metadata", async () => {
        await simulateAutoVectorize(makeRun(), makeAgent(), makeEvaluation());

        const options = mockIngestDocument.mock.calls[0][1];
        expect(options.metadata.overallGrade).toBe(0.91);
        expect(options.metadata.confidenceScore).toBe(0.87);
        expect(options.metadata.evaluationTier).toBe("tier2_auditor");
    });

    // Test 11: Includes provenance metadata
    it("includes agentSlug, runId, source, triggerType, contentType in metadata", async () => {
        await simulateAutoVectorize(makeRun(), makeAgent(), makeEvaluation());

        const options = mockIngestDocument.mock.calls[0][1];
        expect(options.metadata.agentSlug).toBe("company-intelligence");
        expect(options.metadata.runId).toBe("run-1");
        expect(options.metadata.source).toBe("scheduled");
        expect(options.metadata.triggerType).toBe("SCHEDULED");
        expect(options.metadata.contentType).toBe("agent-output");
    });

    // Test 12: Skips when outputText is too short
    it("skips when outputText is null or under 50 chars", async () => {
        await simulateAutoVectorize(
            makeRun({ outputText: "short" }),
            makeAgent(),
            makeEvaluation()
        );
        expect(mockIngestDocument).not.toHaveBeenCalled();

        await simulateAutoVectorize(makeRun({ outputText: null }), makeAgent(), makeEvaluation());
        expect(mockIngestDocument).not.toHaveBeenCalled();
    });

    // Test 13: Skips when autoVectorize is false
    it("skips when agent.autoVectorize is false", async () => {
        await simulateAutoVectorize(
            makeRun(),
            makeAgent({ autoVectorize: false }),
            makeEvaluation()
        );
        expect(mockIngestDocument).not.toHaveBeenCalled();
    });

    // Test 14: Handles missing evaluation gracefully
    it("handles missing evaluation gracefully with null scores in metadata", async () => {
        await simulateAutoVectorize(makeRun(), makeAgent(), null);

        expect(mockIngestDocument).toHaveBeenCalledTimes(1);
        const options = mockIngestDocument.mock.calls[0][1];
        expect(options.metadata.overallGrade).toBeNull();
        expect(options.metadata.confidenceScore).toBeNull();
        expect(options.metadata.evaluationTier).toBeNull();
    });
});
