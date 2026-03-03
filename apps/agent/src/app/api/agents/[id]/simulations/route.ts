import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * GET /api/agents/[id]/simulations
 *
 * List simulation sessions for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const { searchParams } = new URL(request.url);
        const cursor = searchParams.get("cursor");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        // Build query
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { agentId };

        if (cursor) {
            where.id = { lt: cursor };
        }

        // Fetch sessions
        const sessions = await prisma.simulationSession.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit + 1
        });

        // Check for more results
        const hasMore = sessions.length > limit;
        if (hasMore) {
            sessions.pop();
        }

        // Get total count
        const total = await prisma.simulationSession.count({
            where: { agentId }
        });

        return NextResponse.json({
            success: true,
            sessions: sessions.map((session) => ({
                id: session.id,
                theme: session.theme,
                status: session.status,
                targetCount: session.targetCount,
                completedCount: session.completedCount,
                failedCount: session.failedCount,
                concurrency: session.concurrency,
                avgQualityScore: session.avgQualityScore,
                avgDurationMs: session.avgDurationMs,
                successRate: session.successRate,
                totalCostUsd: session.totalCostUsd,
                safetyScore: session.safetyScore,
                safetyPassCount: session.safetyPassCount,
                safetyFailCount: session.safetyFailCount,
                startedAt: session.startedAt,
                completedAt: session.completedAt,
                createdAt: session.createdAt
            })),
            total,
            nextCursor: hasMore ? sessions[sessions.length - 1].id : null
        });
    } catch (error) {
        console.error("[Simulations List] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list simulations"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/simulations
 *
 * Start a new simulation session
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const body = await request.json();
        const { theme, count = 100, concurrency = 5 } = body;

        if (!theme || typeof theme !== "string" || theme.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: "Missing required field: theme" },
                { status: 400 }
            );
        }

        // Validate count and concurrency
        const targetCount = Math.max(1, Math.min(1000, parseInt(String(count)) || 100));
        const validConcurrency = Math.max(1, Math.min(10, parseInt(String(concurrency)) || 5));

        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            select: { slug: true, workspaceId: true }
        });

        // Create simulation session
        const session = await prisma.simulationSession.create({
            data: {
                agentId,
                theme: theme.trim(),
                status: "PENDING",
                targetCount,
                concurrency: validConcurrency
            }
        });

        // Record trigger event for unified triggers dashboard
        try {
            await createTriggerEventRecord({
                agentId,
                workspaceId: agent?.workspaceId || null,
                sourceType: "simulation",
                entityType: "agent",
                payload: { theme: theme.trim(), targetCount, concurrency: validConcurrency },
                metadata: {
                    sessionId: session.id,
                    theme: theme.trim(),
                    targetCount
                }
            });
        } catch (e) {
            console.warn("[Simulations] Failed to record trigger event:", e);
        }

        // Emit Inngest event to start the simulation
        await inngest.send({
            name: "simulation/session.start",
            data: {
                sessionId: session.id,
                agentId,
                theme: theme.trim(),
                targetCount,
                concurrency: validConcurrency
            }
        });

        console.log(
            `[Simulations] Started session ${session.id} for agent ${agent?.slug} with ${targetCount} conversations`
        );

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                theme: session.theme,
                status: session.status,
                targetCount: session.targetCount,
                concurrency: session.concurrency,
                createdAt: session.createdAt
            }
        });
    } catch (error) {
        console.error("[Simulations Create] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create simulation"
            },
            { status: 500 }
        );
    }
}
