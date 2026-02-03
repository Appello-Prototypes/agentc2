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
        // Source filter: "production" (default, excludes simulations), "simulation", or "all"
        const source = searchParams.get("source") || "production";

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

        // Apply source filter
        if (source === "production") {
            // Exclude simulation runs - show only production data
            where.AND = [
                ...(where.AND || []),
                { OR: [{ source: { not: "simulation" } }, { source: null }] }
            ];
        } else if (source === "simulation") {
            // Show only simulation runs
            where.source = "simulation";
        }
        // source === "all" shows everything (no filter)

        if (status) {
            where.status = status.toUpperCase();
        }

        if (search) {
            where.AND = [
                ...(where.AND || []),
                {
                    OR: [
                        { inputText: { contains: search, mode: "insensitive" } },
                        { outputText: { contains: search, mode: "insensitive" } }
                    ]
                }
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
                },
                trace: {
                    select: {
                        tokensJson: true,
                        scoresJson: true,
                        modelJson: true,
                        stepsJson: true, // Also get JSON-stored steps for counting
                        _count: { select: { steps: true, toolCalls: true } }
                    }
                },
                _count: {
                    select: { guardrailEvents: true, toolCalls: true }
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
            runs: runs.map((run) => {
                // Count steps from relational data OR JSON array fallback
                const stepsFromRelation = run.trace?._count.steps ?? 0;
                const stepsFromJson = Array.isArray(run.trace?.stepsJson)
                    ? (run.trace.stepsJson as unknown[]).length
                    : 0;
                const stepsCount = stepsFromRelation > 0 ? stepsFromRelation : stepsFromJson;

                // Count tool calls from trace, run, or JSON
                const toolCallsCount = run.trace?._count.toolCalls ?? run._count.toolCalls ?? 0;

                // Get tokens from run fields (primary) or trace JSON (fallback)
                const traceTokens = run.trace?.tokensJson as {
                    prompt?: number;
                    completion?: number;
                    total?: number;
                } | null;

                return {
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
                    // Tokens: prefer run fields, fall back to trace JSON
                    promptTokens: run.promptTokens ?? traceTokens?.prompt ?? 0,
                    completionTokens: run.completionTokens ?? traceTokens?.completion ?? 0,
                    totalTokens: run.totalTokens ?? traceTokens?.total ?? 0,
                    costUsd: run.costUsd,
                    evaluation: run.evaluation?.scoresJson,
                    feedback: run.feedback,
                    traceTokens: run.trace?.tokensJson,
                    traceScores: run.trace?.scoresJson,
                    traceModel: run.trace?.modelJson,
                    traceStepsCount: stepsCount,
                    traceToolCallsCount: toolCallsCount,
                    guardrailCount: run._count.guardrailEvents ?? 0,
                    versionId: run.versionId,
                    experimentGroup: run.experimentGroup,
                    source: run.source
                };
            }),
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

        // Determine source based on runType
        const runSource = runType.toUpperCase() === "PROD" ? "api" : "test";

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
                startedAt: new Date(),
                source: runSource
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
        const trace = await prisma.agentTrace.create({
            data: {
                runId: run.id,
                agentId: record.id,
                status: "RUNNING",
                inputText: input,
                stepsJson: [],
                modelJson: { provider: record.modelProvider, name: record.modelName },
                tokensJson: {}
            }
        });

        const startTime = Date.now();

        // Execute the agent with streaming
        try {
            const result = await agent.generate(input);

            const durationMs = Date.now() - startTime;

            // Extract usage data - handle both v4 and v5/v6 SDK formats
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawUsage = (result as any).usage || (result as any).totalUsage;
            const usage = rawUsage
                ? {
                      promptTokens: rawUsage.promptTokens ?? rawUsage.inputTokens ?? 0,
                      completionTokens: rawUsage.completionTokens ?? rawUsage.outputTokens ?? 0,
                      totalTokens: rawUsage.totalTokens ?? 0
                  }
                : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

            // Extract tool calls from result
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const rawToolCalls: any[] = (result as any).toolCalls || (result as any).tool_calls || [];
            const rawToolResults: any[] = (result as any).toolResults || (result as any).tool_results || [];
            /* eslint-enable @typescript-eslint/no-explicit-any */

            // Build execution steps
            interface ExecutionStep {
                step: number;
                type: "thinking" | "tool_call" | "tool_result" | "response";
                content: string;
                timestamp: string;
                durationMs?: number;
            }
            const executionSteps: ExecutionStep[] = [];
            let stepCounter = 0;

            // Add tool call steps
            for (const [idx, tc] of rawToolCalls.entries()) {
                stepCounter++;
                const toolName = tc.toolName || tc.name || "unknown";
                const args = tc.args || tc.input || {};
                executionSteps.push({
                    step: stepCounter,
                    type: "tool_call",
                    content: `Calling tool: ${toolName}\nArgs: ${JSON.stringify(args, null, 2)}`,
                    timestamp: new Date().toISOString()
                });

                // Add tool result step if available
                const tr = rawToolResults[idx];
                if (tr) {
                    stepCounter++;
                    const resultPreview =
                        typeof tr.result === "string"
                            ? tr.result.slice(0, 500)
                            : JSON.stringify(tr.result, null, 2).slice(0, 500);
                    executionSteps.push({
                        step: stepCounter,
                        type: "tool_result",
                        content: tr.error
                            ? `Tool ${toolName} failed: ${tr.error}`
                            : `Tool ${toolName} result:\n${resultPreview}`,
                        timestamp: new Date().toISOString()
                    });

                    // Record tool call in database
                    await prisma.agentToolCall.create({
                        data: {
                            runId: run.id,
                            traceId: trace.id,
                            toolKey: toolName,
                            inputJson: args as Prisma.InputJsonValue,
                            outputJson:
                                tr.result !== undefined
                                    ? (tr.result as Prisma.InputJsonValue)
                                    : Prisma.JsonNull,
                            success: !tr.error,
                            error: tr.error || null
                        }
                    });
                }
            }

            // Add final response step
            stepCounter++;
            executionSteps.push({
                step: stepCounter,
                type: "response",
                content:
                    result.text?.slice(0, 2000) +
                    (result.text && result.text.length > 2000 ? "..." : ""),
                timestamp: new Date().toISOString()
            });

            // Update run with results
            await prisma.agentRun.update({
                where: { id: run.id },
                data: {
                    status: "COMPLETED",
                    outputText: result.text,
                    durationMs,
                    completedAt: new Date(),
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens || usage.promptTokens + usage.completionTokens
                }
            });

            // Update trace with steps and scores
            await prisma.agentTrace.update({
                where: { runId: run.id },
                data: {
                    status: "COMPLETED",
                    outputText: result.text,
                    durationMs,
                    stepsJson: executionSteps as unknown as Prisma.JsonArray,
                    tokensJson: usage as Prisma.InputJsonValue
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
            const errorMessage = runError instanceof Error ? runError.message : String(runError);

            // Update run with failure
            await prisma.agentRun.update({
                where: { id: run.id },
                data: {
                    status: "FAILED",
                    outputText: `Error: ${errorMessage}`,
                    durationMs,
                    completedAt: new Date()
                }
            });

            await prisma.agentTrace.update({
                where: { runId: run.id },
                data: {
                    status: "FAILED",
                    outputText: `Error: ${errorMessage}`,
                    durationMs,
                    stepsJson: [
                        {
                            step: 1,
                            type: "response",
                            content: `Error: ${errorMessage}`,
                            timestamp: new Date().toISOString()
                        }
                    ] as unknown as Prisma.JsonArray
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
