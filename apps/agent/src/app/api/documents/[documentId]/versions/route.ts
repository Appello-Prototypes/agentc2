import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getDocument as getDocumentRecord, getDocumentVersions } from "@repo/agentc2/documents";
import { authenticateRequest } from "@/lib/api-auth";
import { getUserOrganizationId } from "@/lib/organization";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * GET /api/documents/[documentId]/versions
 *
 * Get version history for a document
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

        const versions = await getDocumentVersions(documentId);

        return NextResponse.json({ versions });
    } catch (error) {
        console.error("Get document versions error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get versions" },
            { status: 500 }
        );
    }
}
