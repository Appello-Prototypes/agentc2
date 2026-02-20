import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { skillAttachDocument, skillDetachDocument } from "@repo/agentc2/skills";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ skillId: string }> };

/**
 * POST /api/skills/[skillId]/documents
 * Body: { documentId, role? }
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
        const { documentId, role } = await request.json();

        if (!documentId) {
            return NextResponse.json({ error: "documentId is required" }, { status: 400 });
        }

        const junction = await skillAttachDocument(skillId, documentId, role);

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
        const { documentId } = await request.json();

        if (!documentId) {
            return NextResponse.json({ error: "documentId is required" }, { status: 400 });
        }

        await skillDetachDocument(skillId, documentId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Detach document from skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to detach document" },
            { status: 500 }
        );
    }
}
