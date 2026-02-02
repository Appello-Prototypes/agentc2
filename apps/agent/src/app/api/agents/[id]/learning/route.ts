import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { inngest } from "@/lib/inngest";

/**
 * GET /api/agents/[id]/learning
 *
 * List learning sessions for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
        const cursor = searchParams.get("cursor");

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
        const where: any = {
            agentId: agent.id
        };

        if (status) {
            where.status = status;
        }

        if (cursor) {
            where.id = { lt: cursor };
        }

        // Get learning sessions
        const sessions = await prisma.learningSession.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            include: {
                dataset: {
                    select: {
                        runCount: true,
                        avgScore: true,
                        datasetHash: true
                    }
                },
                _count: {
                    select: {
                        signals: true,
                        proposals: true,
                        experiments: true
                    }
                }
            }
        });

        // Check for more results
        const hasMore = sessions.length > limit;
        if (hasMore) {
            sessions.pop();
        }

        // Get summary stats
        const [totalSessions, activeSessions, completedSessions, promotedSessions] =
            await Promise.all([
                prisma.learningSession.count({ where: { agentId: agent.id } }),
                prisma.learningSession.count({
                    where: {
                        agentId: agent.id,
                        status: {
                            in: [
                                "COLLECTING",
                                "ANALYZING",
                                "PROPOSING",
                                "TESTING",
                                "AWAITING_APPROVAL"
                            ]
                        }
                    }
                }),
                prisma.learningSession.count({
                    where: {
                        agentId: agent.id,
                        status: { in: ["APPROVED", "PROMOTED"] }
                    }
                }),
                prisma.learningSession.count({
                    where: {
                        agentId: agent.id,
                        status: "PROMOTED"
                    }
                })
            ]);

        return NextResponse.json({
            success: true,
            sessions: sessions.map((s) => ({
                id: s.id,
                status: s.status,
                runCount: s.runCount,
                datasetHash: s.datasetHash,
                baselineVersion: s.baselineVersion,
                signalCount: s._count.signals,
                proposalCount: s._count.proposals,
                experimentCount: s._count.experiments,
                avgScore: s.dataset?.avgScore,
                metadata: s.metadata,
                createdAt: s.createdAt,
                completedAt: s.completedAt
            })),
            summary: {
                total: totalSessions,
                active: activeSessions,
                completed: completedSessions,
                promoted: promotedSessions
            },
            nextCursor: hasMore ? sessions[sessions.length - 1].id : null
        });
    } catch (error) {
        console.error("[Learning Sessions List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get learning sessions"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/learning
 *
 * Start a new learning session manually
 * Body: { triggerReason?: string }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const triggerReason = body.triggerReason || "Manual trigger via API";

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

        // Check for existing active session
        const activeSession = await prisma.learningSession.findFirst({
            where: {
                agentId: agent.id,
                status: {
                    in: ["COLLECTING", "ANALYZING", "PROPOSING", "TESTING", "AWAITING_APPROVAL"]
                }
            }
        });

        if (activeSession) {
            return NextResponse.json(
                {
                    success: false,
                    error: "An active learning session already exists",
                    activeSessionId: activeSession.id,
                    status: activeSession.status
                },
                { status: 409 }
            );
        }

        // Trigger learning session via Inngest
        await inngest.send({
            name: "learning/session.start",
            data: {
                agentId: agent.id,
                triggerReason
            }
        });

        return NextResponse.json({
            success: true,
            message: "Learning session started",
            agentId: agent.id,
            triggerReason
        });
    } catch (error) {
        console.error("[Learning Session Start] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to start learning session"
            },
            { status: 500 }
        );
    }
}
