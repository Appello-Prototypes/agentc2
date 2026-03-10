import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";

type RouteContext = { params: Promise<{ pulseId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId } = await context.params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const body = await request.json();
        const {
            boardId,
            agentSlug,
            agentId,
            scoreDelta,
            status,
            hypothesis,
            result,
            constraintSuggestion
        } = body;

        if (!boardId || !agentSlug || !status || !hypothesis || !result) {
            return NextResponse.json(
                {
                    success: false,
                    error: "boardId, agentSlug, status, hypothesis, and result are required"
                },
                { status: 400 }
            );
        }

        if (!["keep", "discard", "crash"].includes(status)) {
            return NextResponse.json(
                { success: false, error: "status must be keep, discard, or crash" },
                { status: 400 }
            );
        }

        const board = await prisma.communityBoard.findFirst({
            where: { id: boardId, pulseId }
        });
        if (!board) {
            return NextResponse.json(
                { success: false, error: "Board not found or not part of this Pulse" },
                { status: 404 }
            );
        }

        let resolvedAgentId = agentId;
        if (!resolvedAgentId && agentSlug) {
            const pulse = await prisma.pulse.findUnique({
                where: { id: pulseId },
                select: { workspaceId: true }
            });
            if (pulse) {
                const agent = await prisma.agent.findFirst({
                    where: { slug: agentSlug, workspaceId: pulse.workspaceId },
                    select: { id: true }
                });
                resolvedAgentId = agent?.id;
            }
        }

        const statusEmoji = status === "keep" ? "✅" : status === "discard" ? "❌" : "💥";
        const title = `${statusEmoji} [${status.toUpperCase()}] ${agentSlug}: ${hypothesis.slice(0, 100)}`;
        const content = [
            `**Agent:** ${agentSlug}`,
            `**Status:** ${status}`,
            scoreDelta !== undefined ? `**Score Delta:** ${scoreDelta}` : null,
            "",
            `## Hypothesis`,
            hypothesis,
            "",
            `## Result`,
            result,
            constraintSuggestion ? `\n## Constraint Suggestion\n${constraintSuggestion}` : null
        ]
            .filter(Boolean)
            .join("\n");

        const experimentMetadata = {
            experimentLog: true,
            runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            agentSlug,
            scoreDelta: scoreDelta ?? 0,
            status,
            hypothesis,
            result,
            constraintSuggestion: constraintSuggestion ?? null,
            timestamp: new Date().toISOString()
        };

        const post = await prisma.communityPost.create({
            data: {
                boardId,
                title,
                content,
                authorType: "agent",
                authorAgentId: resolvedAgentId ?? null,
                category: `experiment-${status}`,
                settings: experimentMetadata
            }
        });

        await prisma.communityBoard.update({
            where: { id: boardId },
            data: { postCount: { increment: 1 } }
        });

        return NextResponse.json({ success: true, post }, { status: 201 });
    } catch (error) {
        console.error("[pulse/experiment-log] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
