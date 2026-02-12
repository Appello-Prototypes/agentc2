import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
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
        const { skillId, pinned } = await request.json();

        if (!skillId) {
            return NextResponse.json({ error: "skillId is required" }, { status: 400 });
        }

        const result = await skillAttachToAgent(
            agentId,
            skillId,
            typeof pinned === "boolean" ? pinned : undefined
        );

        return NextResponse.json(result, { status: 201 });
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

        const result = await skillDetachFromAgent(agentId, skillId);

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("Detach skill from agent error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to detach skill" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/agents/[id]/skills
 * Body: { skillId, pinned }
 *
 * Toggle the pinned/discoverable state of a skill attached to an agent.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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
        const { skillId, pinned } = await request.json();

        if (!skillId || typeof pinned !== "boolean") {
            return NextResponse.json(
                { error: "skillId and pinned (boolean) are required" },
                { status: 400 }
            );
        }

        // Find the AgentSkill junction by agentId + skillId
        const agentSkill = await prisma.agentSkill.findFirst({
            where: { agentId, skillId }
        });

        if (!agentSkill) {
            return NextResponse.json(
                { error: "Skill not attached to this agent" },
                { status: 404 }
            );
        }

        // Update the pinned flag
        await prisma.agentSkill.update({
            where: { id: agentSkill.id },
            data: { pinned }
        });

        return NextResponse.json({ success: true, pinned });
    } catch (error) {
        console.error("Toggle skill pinned state error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update skill" },
            { status: 500 }
        );
    }
}
