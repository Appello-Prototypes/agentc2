import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/versions
 *
 * List agent versions with pagination and enriched stats
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const cursor = searchParams.get("cursor");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
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

        if (cursor) {
            where.version = { lt: parseInt(cursor) };
        }

        // Query versions
        const versions = await prisma.agentVersion.findMany({
            where,
            orderBy: { version: "desc" },
            take: limit + 1,
            include: {
                versionStats: {
                    select: {
                        runs: true,
                        successRate: true,
                        avgQuality: true
                    }
                }
            }
        });

        // Check if there are more results
        const hasMore = versions.length > limit;
        if (hasMore) {
            versions.pop();
        }

        const versionIds = versions.map((v) => v.id);
        const versionIdSet = new Set(versionIds);
        const versionTimeline = versions
            .map((v) => ({ id: v.id, createdAtMs: v.createdAt.getTime() }))
            .sort((a, b) => a.createdAtMs - b.createdAtMs);

        const resolveVersionIdForTime = (timeMs: number): string | null => {
            let resolved: string | null = null;
            for (const v of versionTimeline) {
                if (v.createdAtMs <= timeMs) {
                    resolved = v.id;
                } else {
                    break;
                }
            }
            return resolved;
        };

        // Fetch runs with cost/duration for efficient aggregation
        const runs = await prisma.agentRun.findMany({
            where: { agentId: agent.id },
            select: {
                id: true,
                status: true,
                versionId: true,
                startedAt: true,
                costUsd: true,
                durationMs: true
            }
        });

        // Map runs to versions and compute stats
        const runVersionMap = new Map<string, string>();
        const runStatsByVersion = new Map<
            string,
            {
                total: number;
                completed: number;
                totalCost: number;
                totalDuration: number;
                durationCount: number;
            }
        >();

        for (const run of runs) {
            let resolvedVersionId =
                run.versionId && versionIdSet.has(run.versionId) ? run.versionId : null;

            if (!resolvedVersionId) {
                resolvedVersionId = resolveVersionIdForTime(run.startedAt.getTime());
            }

            if (!resolvedVersionId) {
                continue;
            }

            runVersionMap.set(run.id, resolvedVersionId);
            const stats = runStatsByVersion.get(resolvedVersionId) || {
                total: 0,
                completed: 0,
                totalCost: 0,
                totalDuration: 0,
                durationCount: 0
            };
            stats.total += 1;
            if (run.status === "COMPLETED") {
                stats.completed += 1;
            }
            if (run.costUsd) {
                stats.totalCost += run.costUsd;
            }
            if (run.durationMs) {
                stats.totalDuration += run.durationMs;
                stats.durationCount += 1;
            }
            runStatsByVersion.set(resolvedVersionId, stats);
        }

        // Compute quality from evaluations
        const evaluations = await prisma.agentEvaluation.findMany({
            where: { agentId: agent.id },
            select: {
                runId: true,
                scoresJson: true
            }
        });

        const qualityTotalsByVersion = new Map<string, { total: number; count: number }>();
        for (const evaluation of evaluations) {
            const versionId = runVersionMap.get(evaluation.runId);
            if (!versionId) {
                continue;
            }

            const scores = evaluation.scoresJson as Record<string, number>;
            const values = Object.values(scores).filter((value) => typeof value === "number");
            if (values.length === 0) {
                continue;
            }

            const avgScore = values.reduce((a, b) => a + b, 0) / values.length;
            const existing = qualityTotalsByVersion.get(versionId) || { total: 0, count: 0 };
            existing.total += avgScore;
            existing.count += 1;
            qualityTotalsByVersion.set(versionId, existing);
        }

        // Compute feedback stats per version
        const runIds = Array.from(runVersionMap.keys());
        const feedbacks =
            runIds.length > 0
                ? await prisma.agentFeedback.findMany({
                      where: { agentId: agent.id, runId: { in: runIds } },
                      select: { runId: true, thumbs: true }
                  })
                : [];

        const feedbackByVersion = new Map<string, { thumbsUp: number; thumbsDown: number }>();
        for (const fb of feedbacks) {
            const versionId = runVersionMap.get(fb.runId);
            if (!versionId) continue;
            const existing = feedbackByVersion.get(versionId) || { thumbsUp: 0, thumbsDown: 0 };
            if (fb.thumbs === true) existing.thumbsUp += 1;
            else if (fb.thumbs === false) existing.thumbsDown += 1;
            feedbackByVersion.set(versionId, existing);
        }

        // Lookup experiment results for versions that were candidates
        const experimentResults = await prisma.learningExperiment.findMany({
            where: {
                candidateVersionId: { in: versionIds },
                status: { in: ["COMPLETED", "RUNNING"] }
            },
            select: {
                candidateVersionId: true,
                winRate: true,
                gatingResult: true,
                status: true
            }
        });

        const experimentByVersion = new Map<
            string,
            { winRate: number | null; gatingResult: string | null; status: string }
        >();
        for (const exp of experimentResults) {
            if (exp.candidateVersionId) {
                experimentByVersion.set(exp.candidateVersionId, {
                    winRate: exp.winRate,
                    gatingResult: exp.gatingResult,
                    status: exp.status
                });
            }
        }

        // Build enriched response
        const sortedVersions = versions.sort((a, b) => b.version - a.version);

        return NextResponse.json({
            success: true,
            versions: sortedVersions.map((v, index) => {
                const storedStats = v.versionStats[0] || null;
                const runStats = runStatsByVersion.get(v.id);
                const qualityStats = qualityTotalsByVersion.get(v.id);
                const feedback = feedbackByVersion.get(v.id);
                const experiment = experimentByVersion.get(v.id);

                const totalRuns = runStats?.total ?? 0;
                const completedRuns = runStats?.completed ?? 0;
                const successRate =
                    totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 10000) / 100 : 0;
                const avgQuality =
                    qualityStats && qualityStats.count > 0
                        ? Math.round((qualityStats.total / qualityStats.count) * 100) / 100
                        : 0;

                const changesObj = v.changesJson as Record<string, unknown> | null;
                const isRollback = changesObj?.type === "rollback";

                // Previous version is the next item in the desc-sorted array
                const prevVersion = sortedVersions[index + 1] ?? null;

                return {
                    id: v.id,
                    version: v.version,
                    description: v.description,
                    instructions: v.instructions,
                    modelProvider: v.modelProvider,
                    modelName: v.modelName,
                    changesJson: v.changesJson,
                    snapshot: v.snapshot,
                    createdBy: v.createdBy,
                    createdAt: v.createdAt,
                    isActive: v.version === agent.version,
                    isRollback,
                    previousVersion: prevVersion?.version ?? null,
                    stats: {
                        runs: storedStats?.runs ?? totalRuns,
                        successRate: storedStats?.successRate ?? successRate,
                        avgQuality: storedStats?.avgQuality ?? avgQuality,
                        totalCost: Math.round((runStats?.totalCost ?? 0) * 10000) / 10000,
                        avgDurationMs:
                            runStats && runStats.durationCount > 0
                                ? Math.round(runStats.totalDuration / runStats.durationCount)
                                : null,
                        feedbackSummary: feedback ?? { thumbsUp: 0, thumbsDown: 0 }
                    },
                    experimentResult: experiment ?? null
                };
            }),
            currentVersion: agent.version,
            totalCount: await prisma.agentVersion.count({ where: { agentId: agent.id } }),
            nextCursor: hasMore ? versions[versions.length - 1].version.toString() : null
        });
    } catch (error) {
        console.error("[Agent Versions List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list versions"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/versions
 *
 * Create a new version snapshot
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { description, createdBy } = body;

        // Find agent by slug or id with tools and skills
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            },
            include: { tools: true, skills: true }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Create full snapshot
        const snapshot = {
            name: agent.name,
            description: agent.description,
            instructions: agent.instructions,
            instructionsTemplate: agent.instructionsTemplate,
            modelProvider: agent.modelProvider,
            modelName: agent.modelName,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            modelConfig: agent.modelConfig,
            memoryEnabled: agent.memoryEnabled,
            memoryConfig: agent.memoryConfig,
            maxSteps: agent.maxSteps,
            tools: agent.tools.map((t) => ({ toolId: t.toolId, config: t.config })),
            skills: agent.skills.map((s) => ({ skillId: s.skillId, pinned: s.pinned })),
            visibility: agent.visibility,
            metadata: agent.metadata
        };

        // Get the next version number
        const lastVersion = await prisma.agentVersion.findFirst({
            where: { agentId: agent.id },
            orderBy: { version: "desc" },
            select: { version: true }
        });

        const nextVersion = (lastVersion?.version || 0) + 1;

        // Create the version
        const version = await prisma.agentVersion.create({
            data: {
                agentId: agent.id,
                tenantId: agent.tenantId,
                version: nextVersion,
                description: description || `Version ${nextVersion}`,
                instructions: agent.instructions,
                modelProvider: agent.modelProvider,
                modelName: agent.modelName,
                snapshot,
                createdBy
            }
        });

        // Update agent's current version
        await prisma.agent.update({
            where: { id: agent.id },
            data: { version: nextVersion }
        });

        return NextResponse.json({
            success: true,
            version: {
                id: version.id,
                version: version.version,
                description: version.description,
                modelProvider: version.modelProvider,
                modelName: version.modelName,
                createdAt: version.createdAt,
                createdBy: version.createdBy
            }
        });
    } catch (error) {
        console.error("[Agent Version Create] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create version"
            },
            { status: 500 }
        );
    }
}
