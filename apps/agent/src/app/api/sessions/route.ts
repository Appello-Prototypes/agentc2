import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { createSession } from "@repo/agentc2";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const workspaceId = searchParams.get("workspaceId");
        const limit = parseInt(searchParams.get("limit") || "50", 10);

        const sessions = await prisma.agentSession.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(workspaceId ? { workspaceId } : {})
            },
            include: { participants: true },
            orderBy: { createdAt: "desc" },
            take: limit
        });

        return NextResponse.json({
            success: true,
            sessions: sessions.map((s) => ({
                id: s.id,
                name: s.name,
                status: s.status,
                initiatorType: s.initiatorType,
                initiatorId: s.initiatorId,
                peerCallCount: s.peerCallCount,
                maxPeerCalls: s.maxPeerCalls,
                maxDepth: s.maxDepth,
                participantCount: s.participants.length,
                participants: s.participants.map((p) => ({
                    agentSlug: p.agentSlug,
                    role: p.role,
                    invocationCount: p.invocationCount,
                    tokensUsed: p.tokensUsed
                })),
                createdAt: s.createdAt,
                completedAt: s.completedAt,
                durationMs: s.durationMs
            }))
        });
    } catch (error) {
        console.error("[Sessions List] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list sessions" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            agentSlugs,
            task,
            orchestratorSlug,
            scratchpadTemplate,
            maxPeerCalls,
            maxDepth,
            workspaceId,
            organizationId
        } = body;

        if (!name || !agentSlugs || agentSlugs.length < 2) {
            return NextResponse.json(
                { success: false, error: "name and agentSlugs (min 2) are required" },
                { status: 400 }
            );
        }

        const session = await createSession({
            name,
            agentSlugs,
            initiatorType: body.initiatorType || "user",
            initiatorId: body.initiatorId || orchestratorSlug || agentSlugs[0],
            orchestratorSlug,
            scratchpadTemplate:
                scratchpadTemplate ||
                `# Session Scratchpad\n- **Task**: ${task || "(pending)"}\n- **Status**: active\n- **Findings**:\n- **Decisions**:\n- **Open Questions**:`,
            maxPeerCalls,
            maxDepth,
            workspaceId,
            organizationId
        });

        return NextResponse.json({ success: true, session }, { status: 201 });
    } catch (error) {
        console.error("[Sessions Create] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create session" },
            { status: 500 }
        );
    }
}
