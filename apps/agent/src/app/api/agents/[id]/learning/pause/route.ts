import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * POST /api/agents/[id]/learning/pause
 *
 * Pause or resume continuous learning for an agent
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { paused, pausedUntil, reason, actorId } = body;

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

        // Upsert the policy with pause state
        const policy = await prisma.learningPolicy.upsert({
            where: { agentId: agent.id },
            create: {
                agentId: agent.id,
                tenantId: agent.tenantId,
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
                tenantId: agent.tenantId,
                actorId: actorId || "unknown",
                action: paused ? "LEARNING_PAUSED" : "LEARNING_RESUMED",
                entityType: "LearningPolicy",
                entityId: policy.id,
                metadata: {
                    agentSlug: agent.slug,
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
