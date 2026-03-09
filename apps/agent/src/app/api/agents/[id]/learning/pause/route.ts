import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";

/**
 * POST /api/agents/[id]/learning/pause
 *
 * Pause or resume continuous learning for an agent
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

        const { paused, pausedUntil, reason, actorId } = body;

        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            select: { slug: true }
        });

        // Upsert the policy with pause state
        const policy = await prisma.learningPolicy.upsert({
            where: { agentId },
            create: {
                agentId,
                paused: paused ?? true,
                pausedUntil: pausedUntil ? new Date(pausedUntil) : null,
                updatedBy: actorId
            },
            update: {
                paused: paused ?? true,
                pausedUntil: pausedUntil ? new Date(pausedUntil) : null,
                updatedBy: actorId
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                actorId: actorId || "unknown",
                action: paused ? "LEARNING_PAUSED" : "LEARNING_RESUMED",
                entityType: "LearningPolicy",
                entityId: policy.id,
                metadata: {
                    agentSlug: agent!.slug,
                    pausedUntil,
                    reason
                }
            }
        });

        return NextResponse.json({
            success: true,
            paused: policy.paused,
            pausedUntil: policy.pausedUntil,
            message: paused
                ? pausedUntil
                    ? `Learning paused until ${new Date(pausedUntil).toISOString()}`
                    : "Learning paused indefinitely"
                : "Learning resumed"
        });
    } catch (error) {
        console.error("[Learning Pause] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to pause/resume learning"
            },
            { status: 500 }
        );
    }
}
