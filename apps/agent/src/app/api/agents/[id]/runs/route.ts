import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { agentResolver } from "@repo/mastra";
import { TRAFFIC_SPLIT } from "@/lib/learning-config";

/**
 * Experiment routing helper for shadow A/B testing.
 * Returns experiment details and which group the run should be routed to.
 */
async function getExperimentRouting(agentId: string): Promise<{
    experimentId: string | null;
    experimentGroup: "baseline" | "candidate" | null;
    candidateVersionId: string | null;
}> {
    // Find active experiments for this agent
    const activeExperiment = await prisma.learningExperiment.findFirst({
        where: {
            session: { agentId },
            status: "RUNNING"
        },
        include: {
            proposal: {
                select: { riskTier: true, autoEligible: true }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    if (!activeExperiment) {
        return { experimentId: null, experimentGroup: null, candidateVersionId: null };
    }

    // Get traffic split from experiment or use defaults
    const trafficSplit = (activeExperiment.trafficSplit as {
        baseline?: number;
        candidate?: number;
    }) || {
        baseline: 1 - TRAFFIC_SPLIT.defaultCandidateSplit,
        candidate: TRAFFIC_SPLIT.defaultCandidateSplit
    };

    // Randomly route based on traffic split
    const random = Math.random();
    const candidateProbability = trafficSplit.candidate ?? TRAFFIC_SPLIT.defaultCandidateSplit;

    if (random < candidateProbability) {
        return {
            experimentId: activeExperiment.id,
            experimentGroup: "candidate",
            candidateVersionId: activeExperiment.candidateVersionId
        };
    }

    return {
        experimentId: activeExperiment.id,
        experimentGroup: "baseline",
        candidateVersionId: null
    };
}

/**
 * GET /api/agents/[id]/runs
 *
 * List agent runs with filtering and pagination
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const status = searchParams.get("status");
        const search = searchParams.get("search");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const cursor = searchParams.get("cursor");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }],
                isActive: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { agentId: agent.id };

        if (status) {
            where.status = status.toUpperCase();
        }

        if (search) {
            where.OR = [
                { inputText: { contains: search, mode: "insensitive" } },
                { outputText: { contains: search, mode: "insensitive" } }
            ];
        }

        if (from) {
            where.startedAt = { ...where.startedAt, gte: new Date(from) };
        }

        if (to) {
            where.startedAt = { ...where.startedAt, lte: new Date(to) };
        }

        if (cursor) {
            where.id = { lt: cursor };
        }

        // Query runs
        const runs = await prisma.agentRun.findMany({
            where,
            orderBy: { startedAt: "desc" },
            take: limit + 1, // Fetch one extra to check for next page
            include: {
                evaluation: {
                    select: { scoresJson: true }
                },
                feedback: {
                    select: { thumbs: true, rating: true }
                }
            }
        });

        // Check if there are more results
        const hasMore = runs.length > limit;
        if (hasMore) {
            runs.pop();
        }

        // Get total count
        const total = await prisma.agentRun.count({ where: { agentId: agent.id } });

        return NextResponse.json({
            success: true,
            runs: runs.map((run) => ({
                id: run.id,
                runType: run.runType,
                status: run.status,
                inputText: run.inputText,
                outputText: run.outputText,
                durationMs: run.durationMs,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
                modelProvider: run.modelProvider,
                modelName: run.modelName,
                totalTokens: run.totalTokens,
                costUsd: run.costUsd,
                evaluation: run.evaluation?.scoresJson,
                feedback: run.feedback
            })),
            total,
            nextCursor: hasMore ? runs[runs.length - 1].id : null
        });
    } catch (error) {
        console.error("[Agent Runs List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list runs"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/runs
 *
 * Start a new agent run with streaming response
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { input, runType = "TEST", contextVars, versionId } = body;

        if (!input) {
            return NextResponse.json(
                { success: false, error: "Missing required field: input" },
                { status: 400 }
            );
        }

        // Resolve the agent
        const { agent, record, source } = await agentResolver.resolve({
            slug: id,
            id: id,
            requestContext: {
                resource: contextVars,
                metadata: contextVars
            }
        });

        if (!record) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found in database` },
                { status: 404 }
            );
        }

        // Check for active experiment and get routing decision
        const { experimentId, experimentGroup, candidateVersionId } = await getExperimentRouting(
            record.id
        );

        // Determine effective version ID
        // If routed to candidate, use the candidate version; otherwise use baseline (current)
        const effectiveVersionId =
            experimentGroup === "candidate" && candidateVersionId
                ? candidateVersionId
                : versionId || null;

        // Create the run record with experiment linkage
        const run = await prisma.agentRun.create({
            data: {
                agentId: record.id,
                runType: experimentGroup ? "AB" : (runType.toUpperCase() as "TEST" | "PROD" | "AB"),
                status: "RUNNING",
                inputText: input,
                modelProvider: record.modelProvider,
                modelName: record.modelName,
                versionId: effectiveVersionId,
                experimentId,
                experimentGroup,
                startedAt: new Date()
            }
        });

        // Update experiment run counts if this is part of an experiment
        if (experimentId && experimentGroup) {
            const updateField =
                experimentGroup === "baseline" ? "baselineRunCount" : "candidateRunCount";

            await prisma.learningExperiment.update({
                where: { id: experimentId },
                data: {
                    shadowRunCount: { increment: 1 },
                    [updateField]: { increment: 1 }
                }
            });
        }

        // Create trace record
        await prisma.agentTrace.create({
            data: {
                runId: run.id,
                agentId: record.id,
                status: "RUNNING",
                inputText: input
            }
        });

        const startTime = Date.now();

        // Execute the agent with streaming
        try {
            const result = await agent.generate(input);

            const durationMs = Date.now() - startTime;

            // Extract usage data
            const usage = result.usage
                ? {
                      promptTokens: (result.usage as { promptTokens?: number }).promptTokens ?? 0,
                      completionTokens:
                          (result.usage as { completionTokens?: number }).completionTokens ?? 0,
                      totalTokens: (result.usage as { totalTokens?: number }).totalTokens ?? 0
                  }
                : null;

            // Update run with results
            await prisma.agentRun.update({
                where: { id: run.id },
                data: {
                    status: "COMPLETED",
                    outputText: result.text,
                    durationMs,
                    completedAt: new Date(),
                    promptTokens: usage?.promptTokens,
                    completionTokens: usage?.completionTokens,
                    totalTokens: usage?.totalTokens
                }
            });

            // Update trace
            await prisma.agentTrace.update({
                where: { runId: run.id },
                data: {
                    status: "COMPLETED",
                    outputText: result.text,
                    durationMs,
                    tokensJson: usage ? (usage as Prisma.InputJsonValue) : Prisma.JsonNull
                }
            });

            return NextResponse.json({
                success: true,
                runId: run.id,
                output: result.text,
                durationMs,
                usage: result.usage,
                source,
                // Experiment info for shadow A/B testing
                experiment: experimentId
                    ? {
                          experimentId,
                          group: experimentGroup
                      }
                    : null
            });
        } catch (runError) {
            const durationMs = Date.now() - startTime;

            // Update run with failure
            await prisma.agentRun.update({
                where: { id: run.id },
                data: {
                    status: "FAILED",
                    durationMs,
                    completedAt: new Date()
                }
            });

            await prisma.agentTrace.update({
                where: { runId: run.id },
                data: {
                    status: "FAILED",
                    durationMs
                }
            });

            throw runError;
        }
    } catch (error) {
        console.error("[Agent Run] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to run agent"
            },
            { status: 500 }
        );
    }
}
