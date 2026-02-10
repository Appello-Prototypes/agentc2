import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { getDocumentRecord } from "@repo/mastra";
import { authenticateRequest } from "@/lib/api-auth";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

type RouteContext = { params: Promise<{ documentId: string }> };

const embedder = openai.embedding("text-embedding-3-small");

/**
 * GET /api/documents/[documentId]/chunks
 *
 * Retrieves all vector chunks belonging to a document from the vector store.
 * Uses the document's name as a query to generate an embedding, then filters
 * by documentId metadata to return all chunks.
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

        // Get the document to find its slug (used as documentId in vectors)
        const document = await getDocumentRecord(documentId);
        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // We need a query vector to search -- embed the document's name as a representative query
        const { embedding } = await embed({
            model: embedder,
            value: document.name + " " + (document.description || "")
        });

        // Import vector store directly to query with filter
        const { vector } = await import("@repo/mastra");

        const results = await vector.query({
            indexName: "rag_documents",
            queryVector: embedding,
            topK: 200,
            minScore: 0,
            filter: { documentId: document.slug }
        });

        // Sort by chunk index for consistent ordering
        const chunks = results
            .map((r) => ({
                id: r.id,
                score: r.score,
                text: r.metadata?.text || "",
                chunkIndex: r.metadata?.chunkIndex ?? -1,
                charCount: r.metadata?.charCount || 0,
                totalChunks: r.metadata?.totalChunks || 0,
                ingestedAt: r.metadata?.ingestedAt || "",
                documentId: r.metadata?.documentId || "",
                sourceName: r.metadata?.sourceName || "",
                metadata: r.metadata || {}
            }))
            .sort((a, b) => a.chunkIndex - b.chunkIndex);

        return NextResponse.json({
            documentId: document.id,
            documentSlug: document.slug,
            chunkCount: chunks.length,
            chunks
        });
    } catch (error) {
        console.error("Get document chunks error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get chunks" },
            { status: 500 }
        );
    }
}
