import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getDocumentVersions } from "@repo/agentc2/documents";
import { authenticateRequest } from "@/lib/api-auth";

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

        if (!userId) {
            const session = await auth.api.getSession({
                headers: await headers()
            });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { documentId } = await context.params;
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
