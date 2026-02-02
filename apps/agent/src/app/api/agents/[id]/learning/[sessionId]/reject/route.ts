import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * POST /api/agents/[id]/learning/[sessionId]/reject
 *
 * Reject a learning session
 * Body: { rejectedBy: string, rationale?: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
    try {
        const { id, sessionId } = await params;
        const body = await request.json();

        if (!body.rejectedBy) {
            return NextResponse.json(
                { success: false, error: "rejectedBy is required" },
                { status: 400 }
            );
        }

        const { rejectedBy, rationale } = body;

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

        // Get session
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

        if (session.status !== "AWAITING_APPROVAL") {
            return NextResponse.json(
                {
                    success: false,
                    error: `Session is not awaiting approval (status: ${session.status})`
                },
                { status: 400 }
            );
        }

        // Update approval record
        await prisma.learningApproval.update({
            where: { sessionId },
            data: {
                decision: "rejected",
                approvedBy: rejectedBy,
                rationale,
                reviewedAt: new Date()
            }
        });

        // Update session status
        await prisma.learningSession.update({
            where: { id: sessionId },
            data: {
                status: "REJECTED",
                completedAt: new Date()
            }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                tenantId: session.tenantId,
                actorId: rejectedBy,
                action: "LEARNING_SESSION_REJECTED",
                entityType: "LearningSession",
                entityId: sessionId,
                metadata: { rationale }
            }
        });

        return NextResponse.json({
            success: true,
            message: "Learning session rejected",
            sessionId,
            rejectedBy,
            status: "REJECTED"
        });
    } catch (error) {
        console.error("[Learning Session Reject] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to reject learning session"
            },
            { status: 500 }
        );
    }
}
