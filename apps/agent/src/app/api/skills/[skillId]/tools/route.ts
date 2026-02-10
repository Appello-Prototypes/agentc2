import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { skillAttachTool, skillDetachTool } from "@repo/mastra";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ skillId: string }> };

/**
 * POST /api/skills/[skillId]/tools
 * Body: { toolId }
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

        const { skillId } = await context.params;
        const { toolId } = await request.json();

        if (!toolId) {
            return NextResponse.json({ error: "toolId is required" }, { status: 400 });
        }

        const junction = await skillAttachTool(skillId, toolId);

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
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;

        if (!userId) {
            const session = await auth.api.getSession({ headers: await headers() });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { skillId } = await context.params;
        const { toolId } = await request.json();

        if (!toolId) {
            return NextResponse.json({ error: "toolId is required" }, { status: 400 });
        }

        await skillDetachTool(skillId, toolId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Detach tool from skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to detach tool" },
            { status: 500 }
        );
    }
}
