import { NextRequest, NextResponse } from "next/server";
import { getSkill, skillAttachDocument, skillDetachDocument } from "@repo/agentc2/skills";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ skillId: string }> };

/**
 * POST /api/skills/[skillId]/documents
 * Body: { documentId, role? }
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

        const { documentId, role } = await request.json();

        if (!documentId) {
            return NextResponse.json({ error: "documentId is required" }, { status: 400 });
        }

        const junction = await skillAttachDocument(skill.id, documentId, role);

        return NextResponse.json(junction, { status: 201 });
    } catch (error) {
        console.error("Attach document to skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to attach document" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/skills/[skillId]/documents
 * Body: { documentId }
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

        const { documentId } = await request.json();

        if (!documentId) {
            return NextResponse.json({ error: "documentId is required" }, { status: 400 });
        }

        await skillDetachDocument(skill.id, documentId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Detach document from skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to detach document" },
            { status: 500 }
        );
    }
}
