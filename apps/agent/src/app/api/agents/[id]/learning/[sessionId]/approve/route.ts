import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { inngest } from "@/lib/inngest";

/**
 * POST /api/agents/[id]/learning/[sessionId]/approve
 *
 * Approve a learning session and promote the candidate version
 * Body: { approvedBy: string, rationale?: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
    try {
        const { id, sessionId } = await params;
        const body = await request.json();

        if (!body.approvedBy) {
            return NextResponse.json(
                { success: false, error: "approvedBy is required" },
                { status: 400 }
            );
        }

        const { approvedBy, rationale } = body;

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
            },
            include: {
                proposals: {
                    where: { isSelected: true }
                },
                approval: true
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

        const selectedProposal = session.proposals[0];
        if (!selectedProposal?.candidateVersionId) {
            return NextResponse.json(
                { success: false, error: "No candidate version found for this session" },
                { status: 400 }
            );
        }

        // Trigger version promotion via Inngest
        await inngest.send({
            name: "learning/version.promote",
            data: {
                sessionId,
                approvedBy,
                rationale
            }
        });

        return NextResponse.json({
            success: true,
            message: "Approval submitted, version promotion in progress",
            sessionId,
            approvedBy,
            candidateVersionId: selectedProposal.candidateVersionId
        });
    } catch (error) {
        console.error("[Learning Session Approve] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to approve learning session"
            },
            { status: 500 }
        );
    }
}
