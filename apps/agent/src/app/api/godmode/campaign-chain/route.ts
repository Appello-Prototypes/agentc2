import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

interface CausalNode {
    type: "campaign" | "mission" | "task" | "agentRun" | "trace";
    id: string;
    name: string;
    status: string;
    children: CausalNode[];
    metadata?: Record<string, unknown>;
}

/**
 * GET /api/godmode/campaign-chain?campaignId=xxx
 *
 * Walk the full execution tree:
 *   Campaign -> Missions -> Tasks -> AgentRun -> Trace
 *
 * Returns a nested CausalNode tree for God Mode inspection.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const campaignId = searchParams.get("campaignId");

        if (!campaignId) {
            return NextResponse.json(
                { success: false, error: "campaignId is required" },
                { status: 400 }
            );
        }

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                missions: {
                    orderBy: [{ sequence: "asc" }, { priority: "desc" }],
                    include: {
                        tasks: {
                            orderBy: { sequence: "asc" },
                            include: {
                                agentRun: {
                                    select: {
                                        id: true,
                                        status: true,
                                        durationMs: true,
                                        costUsd: true,
                                        totalTokens: true,
                                        agentId: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!campaign) {
            return NextResponse.json(
                { success: false, error: "Campaign not found" },
                { status: 404 }
            );
        }

        const agentRunIds = campaign.missions
            .flatMap((m) => m.tasks)
            .map((t) => t.agentRun?.id)
            .filter((id): id is string => id != null);

        const traces =
            agentRunIds.length > 0
                ? await prisma.agentTrace.findMany({
                      where: { runId: { in: agentRunIds } },
                      select: {
                          id: true,
                          runId: true,
                          status: true,
                          stepsJson: true
                      }
                  })
                : [];

        const traceByRunId = new Map(traces.map((t) => [t.runId, t]));

        const tree: CausalNode = {
            type: "campaign",
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            metadata: {
                slug: campaign.slug,
                intent: campaign.intent.slice(0, 200),
                startedAt: campaign.startedAt,
                completedAt: campaign.completedAt,
                totalCostUsd: campaign.totalCostUsd
            },
            children: campaign.missions.map((mission) => ({
                type: "mission" as const,
                id: mission.id,
                name: mission.name,
                status: mission.status,
                metadata: {
                    sequence: mission.sequence,
                    priority: mission.priority,
                    missionStatement: mission.missionStatement.slice(0, 200)
                },
                children: mission.tasks.map((task) => {
                    const taskNode: CausalNode = {
                        type: "task",
                        id: task.id,
                        name: task.name,
                        status: task.status,
                        metadata: {
                            taskVerb: task.taskVerb,
                            taskType: task.taskType,
                            sequence: task.sequence
                        },
                        children: []
                    };

                    if (task.agentRun) {
                        const runNode: CausalNode = {
                            type: "agentRun",
                            id: task.agentRun.id,
                            name: `Run (${task.agentRun.status})`,
                            status: task.agentRun.status,
                            metadata: {
                                durationMs: task.agentRun.durationMs,
                                costUsd: task.agentRun.costUsd,
                                totalTokens: task.agentRun.totalTokens
                            },
                            children: []
                        };

                        const trace = traceByRunId.get(task.agentRun.id);
                        if (trace) {
                            const stepsJson = trace.stepsJson as unknown[];
                            runNode.children.push({
                                type: "trace",
                                id: trace.id,
                                name: `Trace (${Array.isArray(stepsJson) ? stepsJson.length : 0} steps)`,
                                status: trace.status,
                                children: []
                            });
                        }

                        taskNode.children.push(runNode);
                    }

                    return taskNode;
                })
            }))
        };

        return NextResponse.json({ success: true, tree });
    } catch (error) {
        console.error("[Campaign Chain] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
