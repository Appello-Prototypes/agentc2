import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * DELETE /api/agents/[id]/learning/[sessionId]
 *
 * Cancel an active learning session
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
    try {
        const { id, sessionId } = await params;
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || "Cancelled via UI";

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

        // Get the session
        const session = await prisma.learningSession.findFirst({
            where: {
                id: sessionId,
                agentId: agent.id
            }
        });

        if (!session) {
            return NextResponse.json(
                { success: false, error: `Learning session '${sessionId}' not found` },
                { status: 404 }
            );
        }

        // Check if session can be cancelled
        const cancellableStatuses = [
            "COLLECTING",
            "ANALYZING",
            "PROPOSING",
            "TESTING",
            "AWAITING_APPROVAL"
        ];
        if (!cancellableStatuses.includes(session.status)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot cancel session with status '${session.status}'`
                },
                { status: 400 }
            );
        }

        // Update session to cancelled
        const updatedSession = await prisma.learningSession.update({
            where: { id: sessionId },
            data: {
                status: "FAILED",
                completedAt: new Date(),
                metadata: {
                    ...((session.metadata as Record<string, unknown>) || {}),
                    cancelledAt: new Date().toISOString(),
                    cancelReason: reason
                }
            }
        });

        // Log audit event
        await prisma.auditLog.create({
            data: {
                tenantId: agent.tenantId,
                actorId: "current-user",
                action: "LEARNING_SESSION_CANCELLED",
                entityType: "LearningSession",
                entityId: sessionId,
                metadata: { reason }
            }
        });

        return NextResponse.json({
            success: true,
            message: "Learning session cancelled",
            session: {
                id: updatedSession.id,
                status: updatedSession.status,
                completedAt: updatedSession.completedAt
            }
        });
    } catch (error) {
        console.error("[Learning Session Cancel] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to cancel learning session"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/agents/[id]/learning/[sessionId]
 *
 * Get detailed learning session information
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
    try {
        const { id, sessionId } = await params;

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

        // Get session with all related data
        const session = await prisma.learningSession.findFirst({
            where: {
                id: sessionId,
                agentId: agent.id
            },
            include: {
                dataset: true,
                signals: {
                    orderBy: { createdAt: "desc" }
                },
                proposals: {
                    orderBy: { createdAt: "desc" }
                },
                experiments: {
                    orderBy: { createdAt: "desc" }
                },
                approval: true,
                agent: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        version: true
                    }
                }
            }
        });

        if (!session) {
            return NextResponse.json(
                { success: false, error: `Learning session '${sessionId}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                status: session.status,
                runCount: session.runCount,
                datasetHash: session.datasetHash,
                baselineVersion: session.baselineVersion,
                scorerConfig: session.scorerConfig,
                thresholdsJson: session.thresholdsJson,
                metadata: session.metadata,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                completedAt: session.completedAt
            },
            agent: session.agent,
            dataset: session.dataset
                ? {
                      id: session.dataset.id,
                      runCount: session.dataset.runCount,
                      avgScore: session.dataset.avgScore,
                      datasetHash: session.dataset.datasetHash,
                      fromDate: session.dataset.fromDate,
                      toDate: session.dataset.toDate,
                      selectionCriteria: session.dataset.selectionCriteria,
                      runIds: session.dataset.runIds
                  }
                : null,
            signals: session.signals.map((s) => ({
                id: s.id,
                type: s.type,
                severity: s.severity,
                pattern: s.pattern,
                frequency: s.frequency,
                impact: s.impact,
                evidenceJson: s.evidenceJson,
                createdAt: s.createdAt
            })),
            proposals: session.proposals.map((p) => ({
                id: p.id,
                proposalType: p.proposalType,
                title: p.title,
                description: p.description,
                instructionsDiff: p.instructionsDiff,
                toolChangesJson: p.toolChangesJson,
                memoryChangesJson: p.memoryChangesJson,
                modelChangesJson: p.modelChangesJson,
                expectedImpact: p.expectedImpact,
                confidenceScore: p.confidenceScore,
                generatedBy: p.generatedBy,
                candidateVersionId: p.candidateVersionId,
                isSelected: p.isSelected,
                createdAt: p.createdAt
            })),
            experiments: session.experiments.map((e) => ({
                id: e.id,
                status: e.status,
                baselineVersionId: e.baselineVersionId,
                candidateVersionId: e.candidateVersionId,
                baselineMetrics: e.baselineMetrics,
                candidateMetrics: e.candidateMetrics,
                gatingThreshold: e.gatingThreshold,
                winRate: e.winRate,
                confidenceInterval: e.confidenceInterval,
                gatingResult: e.gatingResult,
                testCaseCount: e.testCaseIds.length,
                syntheticTestCount: e.syntheticTestCount,
                startedAt: e.startedAt,
                completedAt: e.completedAt,
                createdAt: e.createdAt
            })),
            approval: session.approval
                ? {
                      id: session.approval.id,
                      decision: session.approval.decision,
                      rationale: session.approval.rationale,
                      approvedBy: session.approval.approvedBy,
                      promotedVersionId: session.approval.promotedVersionId,
                      reviewedAt: session.approval.reviewedAt,
                      createdAt: session.approval.createdAt
                  }
                : null
        });
    } catch (error) {
        console.error("[Learning Session Detail] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get learning session"
            },
            { status: 500 }
        );
    }
}
