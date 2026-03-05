import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { skillAttachToAgent, skillDetachFromAgent } from "@repo/agentc2/skills";
import { requireAuth, requireAgentAccess } from "@/lib/authz";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/agents/[id]/skills
 * Body: { skillId }
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { context: authContext } = auth;

        const { id: agentId } = await context.params;

        const access = await requireAgentAccess(authContext.organizationId, agentId);
        if (access.response) return access.response;

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
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { context: authContext } = auth;

        const { id: agentId } = await context.params;

        const access = await requireAgentAccess(authContext.organizationId, agentId);
        if (access.response) return access.response;

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
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { context: authContext } = auth;

        const { id: agentId } = await context.params;

        const access = await requireAgentAccess(authContext.organizationId, agentId);
        if (access.response) return access.response;

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
