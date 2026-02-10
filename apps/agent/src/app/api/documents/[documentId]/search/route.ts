import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { searchDocumentRecords } from "@repo/mastra";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * POST /api/documents/[documentId]/search
 *
 * Semantic search scoped to this document
 */
export async function POST(request: NextRequest, context: RouteContext) {
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
        const body = await request.json();

        if (!body.query) {
            return NextResponse.json({ error: "query is required" }, { status: 400 });
        }

        const results = await searchDocumentRecords({
            query: body.query,
            documentId,
            topK: body.topK,
            minScore: body.minScore
        });

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Search document error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to search document" },
            { status: 500 }
        );
    }
}
