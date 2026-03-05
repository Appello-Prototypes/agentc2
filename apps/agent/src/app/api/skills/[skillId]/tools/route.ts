import { NextRequest, NextResponse } from "next/server";
import { getSkill, skillAttachTool, skillDetachTool } from "@repo/agentc2/skills";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ skillId: string }> };

/**
 * POST /api/skills/[skillId]/tools
 * Body: { toolId }
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const authCtx = await authenticateRequest(request);
        if (!authCtx) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { skillId } = await context.params;

        const skill = await getSkill(skillId, authCtx.organizationId);
        if (!skill) {
            return NextResponse.json({ error: "Skill not found" }, { status: 404 });
        }

        const { toolId } = await request.json();

        if (!toolId) {
            return NextResponse.json({ error: "toolId is required" }, { status: 400 });
        }

        const junction = await skillAttachTool(skill.id, toolId);

        return NextResponse.json(junction, { status: 201 });
    } catch (error) {
        console.error("Attach tool to skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to attach tool" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/skills/[skillId]/tools
 * Body: { toolId }
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const authCtx = await authenticateRequest(request);
        if (!authCtx) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { skillId } = await context.params;

        const skill = await getSkill(skillId, authCtx.organizationId);
        if (!skill) {
            return NextResponse.json({ error: "Skill not found" }, { status: 404 });
        }

        const { toolId } = await request.json();

        if (!toolId) {
            return NextResponse.json({ error: "toolId is required" }, { status: 400 });
        }

        await skillDetachTool(skill.id, toolId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Detach tool from skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to detach tool" },
            { status: 500 }
        );
    }
}
