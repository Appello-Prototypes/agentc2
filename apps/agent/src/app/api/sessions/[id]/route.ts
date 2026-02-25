import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { readScratchpad, completeSession } from "@repo/agentc2";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await prisma.agentSession.findUnique({
            where: { id },
            include: { participants: true }
        });

        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            );
        }

        const scratchpad = await readScratchpad(id);

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                name: session.name,
                description: session.description,
                status: session.status,
                memoryResourceId: session.memoryResourceId,
                memoryThreadId: session.memoryThreadId,
                initiatorType: session.initiatorType,
                initiatorId: session.initiatorId,
                peerCallCount: session.peerCallCount,
                maxPeerCalls: session.maxPeerCalls,
                maxDepth: session.maxDepth,
                scratchpad,
                participants: session.participants.map((p) => ({
                    agentSlug: p.agentSlug,
                    role: p.role,
                    invocationCount: p.invocationCount,
                    tokensUsed: p.tokensUsed,
                    joinedAt: p.joinedAt
                })),
                createdAt: session.createdAt,
                completedAt: session.completedAt,
                durationMs: session.durationMs
            }
        });
    } catch (error) {
        console.error("[Session Get] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get session" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status } = body;

        if (status && ["completed", "failed", "cancelled"].includes(status)) {
            await completeSession(id, status);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { success: false, error: "Invalid status. Must be: completed, failed, or cancelled" },
            { status: 400 }
        );
    } catch (error) {
        console.error("[Session Update] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update session" },
            { status: 500 }
        );
    }
}
