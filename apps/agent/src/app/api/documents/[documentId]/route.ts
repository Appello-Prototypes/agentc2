import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import {
    getDocumentRecord,
    updateDocumentRecord,
    deleteDocumentRecord,
    type UpdateDocumentInput
} from "@repo/mastra/documents";
import { authenticateRequest } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ documentId: string }> };

/**
 * GET /api/documents/[documentId]
 *
 * Get a single document by ID or slug
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
        const document = await getDocumentRecord(documentId);

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        return NextResponse.json(document);
    } catch (error) {
        console.error("Get document error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get document" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/documents/[documentId]
 *
 * Update a document (auto re-embeds if content changed)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
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

        const input: UpdateDocumentInput = {
            name: body.name,
            description: body.description,
            content: body.content,
            contentType: body.contentType,
            category: body.category,
            tags: body.tags,
            metadata: body.metadata,
            changeSummary: body.changeSummary,
            createdBy: userId,
            chunkOptions: body.chunkOptions
        };

        const document = await updateDocumentRecord(documentId, input);

        return NextResponse.json(document);
    } catch (error) {
        console.error("Update document error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update document" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/documents/[documentId]
 *
 * Delete a document and its vectors
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

        await deleteDocumentRecord(documentId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete document error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete document" },
            { status: 500 }
        );
    }
}
