import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { skillAttachToAgent, skillDetachFromAgent } from "@repo/mastra";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/agents/[id]/skills
 * Body: { skillId }
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;

        if (!userId) {
            const session = await auth.api.getSession({ headers: await headers() });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: agentId } = await context.params;
        const { skillId } = await request.json();

        if (!skillId) {
            return NextResponse.json({ error: "skillId is required" }, { status: 400 });
        }

        const junction = await skillAttachToAgent(agentId, skillId);

        return NextResponse.json(junction, { status: 201 });
    } catch (error) {
        console.error("Attach skill to agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to attach skill" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agents/[id]/skills
 * Body: { skillId }
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;

        if (!userId) {
            const session = await auth.api.getSession({ headers: await headers() });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: agentId } = await context.params;
        const { skillId } = await request.json();

        if (!skillId) {
            return NextResponse.json({ error: "skillId is required" }, { status: 400 });
        }

        await skillDetachFromAgent(agentId, skillId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Detach skill from agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to detach skill" },
            { status: 500 }
        );
    }
}
