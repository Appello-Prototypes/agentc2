import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getEffectiveConfig } from "@/lib/learning-config";

/**
 * GET /api/agents/[id]/learning/policy
 *
 * Get the learning policy for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }],
                isActive: true
            },
            include: {
                learningPolicy: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Get effective config (merging defaults with overrides)
        const effectiveConfig = getEffectiveConfig(agent.learningPolicy || {});

        return NextResponse.json({
            success: true,
            policy: agent.learningPolicy || null,
            effectiveConfig,
            defaults: {
                signalThreshold: 5,
                signalWindowMinutes: 60,
                trafficSplitCandidate: 0.1,
                minConfidenceForAuto: 0.7,
                minWinRateForAuto: 0.55,
                autoPromotionEnabled: false,
                scheduledEnabled: true,
                thresholdEnabled: true
            }
        });
    } catch (error) {
        console.error("[Learning Policy GET] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get policy"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/learning/policy
 *
 * Create or update the learning policy for an agent
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

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

        // Validate and extract policy fields
        const {
            enabled,
            autoPromotionEnabled,
            scheduledEnabled,
            thresholdEnabled,
            signalThreshold,
            signalWindowMinutes,
            trafficSplitCandidate,
            minConfidenceForAuto,
            minWinRateForAuto,
            updatedBy
        } = body;

        // Upsert the policy
        const policy = await prisma.learningPolicy.upsert({
            where: { agentId: agent.id },
            create: {
                agentId: agent.id,
                tenantId: agent.tenantId,
                enabled: enabled ?? true,
                autoPromotionEnabled: autoPromotionEnabled ?? false,
                scheduledEnabled: scheduledEnabled ?? true,
                thresholdEnabled: thresholdEnabled ?? true,
                signalThreshold,
                signalWindowMinutes,
                trafficSplitCandidate,
                minConfidenceForAuto,
                minWinRateForAuto,
                updatedBy
            },
            update: {
                enabled: enabled ?? undefined,
                autoPromotionEnabled: autoPromotionEnabled ?? undefined,
                scheduledEnabled: scheduledEnabled ?? undefined,
                thresholdEnabled: thresholdEnabled ?? undefined,
                signalThreshold: signalThreshold ?? undefined,
                signalWindowMinutes: signalWindowMinutes ?? undefined,
                trafficSplitCandidate: trafficSplitCandidate ?? undefined,
                minConfidenceForAuto: minConfidenceForAuto ?? undefined,
                minWinRateForAuto: minWinRateForAuto ?? undefined,
                updatedBy
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                tenantId: agent.tenantId,
                actorId: updatedBy || "unknown",
                action: "LEARNING_POLICY_UPDATED",
                entityType: "LearningPolicy",
                entityId: policy.id,
                metadata: {
                    agentSlug: agent.slug,
                    changes: body
                }
            }
        });

        return NextResponse.json({
            success: true,
            policy
        });
    } catch (error) {
        console.error("[Learning Policy POST] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update policy"
            },
            { status: 500 }
        );
    }
}
