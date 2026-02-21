import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getDocument as getDocumentRecord, reembedDocument } from "@repo/agentc2/documents";
import { authenticateRequest } from "@/lib/api-auth";
import { getUserOrganizationId } from "@/lib/organization";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * POST /api/documents/[documentId]/reembed
 *
 * Force re-chunk and re-embed a document without creating a version snapshot.
 * Useful after changing embedding config or to refresh stale vectors.
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;
        let organizationId = apiAuth?.organizationId;

        if (!userId) {
            const session = await auth.api.getSession({
                headers: await headers()
            });
            userId = session?.user?.id;
            if (userId) {
                organizationId = (await getUserOrganizationId(userId)) || undefined;
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { documentId } = await context.params;

        const existing = await getDocumentRecord(documentId);
        if (!existing) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        if (
            existing.organizationId &&
            organizationId &&
            existing.organizationId !== organizationId
        ) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        const document = await reembedDocument(documentId);

        return NextResponse.json({
            success: true,
            chunkCount: document.chunkCount,
            vectorIds: document.vectorIds,
            embeddedAt: document.embeddedAt
        });
    } catch (error) {
        console.error("Reembed document error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to re-embed document" },
            { status: 500 }
        );
    }
}
