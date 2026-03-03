import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { getUserOrganizationId } from "@/lib/organization";

/**
 * GET /api/vectors/[documentId]
 *
 * List all vector chunks for a specific documentId from the rag_documents table.
 * Returns chunk text, metadata, and vector preview (first 10 dims).
 *
 * Query params:
 *   - page (default 1)
 *   - pageSize (default 50, max 200)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ documentId: string }> }
) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;
        let organizationId = apiAuth?.organizationId;

        if (!userId) {
            const session = await auth.api.getSession({
                headers: await headers()
            });
            userId = session?.user?.id;
            if (userId && !organizationId) {
                organizationId = (await getUserOrganizationId(userId)) ?? undefined;
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: "Organization context required" }, { status: 403 });
        }

        const { documentId } = await params;
        const decodedDocId = decodeURIComponent(documentId);

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const pageSize = Math.min(
            200,
            Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10))
        );
        const offset = (page - 1) * pageSize;

        const countResult = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
            `SELECT count(*) as cnt FROM rag_documents WHERE metadata->>'documentId' = $1 AND metadata->>'organizationId' = $2`,
            decodedDocId,
            organizationId
        );
        const totalChunks = Number(countResult[0]?.cnt || 0);

        // Fetch chunks with metadata and vector preview
        // pgvector's text representation uses [] brackets, but PostgreSQL
        // array literals require {} — convert before casting to float8[].
        const chunks = await prisma.$queryRawUnsafe<
            Array<{
                vector_id: string;
                metadata: Record<string, unknown>;
                vector_preview: number[];
                vector_dims: number;
            }>
        >(
            `SELECT 
                vector_id,
                metadata,
                ((replace(replace(embedding::text, '[', '{'), ']', '}'))::float8[])[1:10] as vector_preview,
                array_length((replace(replace(embedding::text, '[', '{'), ']', '}'))::float8[], 1) as vector_dims
            FROM rag_documents
            WHERE metadata->>'documentId' = $1 AND metadata->>'organizationId' = $4
            ORDER BY (metadata->>'chunkIndex')::int ASC NULLS LAST
            LIMIT $2 OFFSET $3`,
            decodedDocId,
            pageSize,
            offset,
            organizationId
        );

        // Get summary info
        const summaryResult = await prisma.$queryRawUnsafe<
            Array<{
                source_name: string;
                first_ingested: string;
                last_ingested: string;
            }>
        >(
            `SELECT 
                COALESCE(MAX(metadata->>'sourceName'), $1) as source_name,
                MIN(metadata->>'ingestedAt') as first_ingested,
                MAX(metadata->>'ingestedAt') as last_ingested
            FROM rag_documents
            WHERE metadata->>'documentId' = $1 AND metadata->>'organizationId' = $2`,
            decodedDocId,
            organizationId
        );

        // Check if there's a managed Document record
        const managedDoc = await prisma.document.findFirst({
            where: { slug: decodedDocId, organizationId },
            select: { id: true, slug: true, name: true }
        });

        const formattedChunks = chunks.map((c) => ({
            vectorId: c.vector_id,
            text: (c.metadata as Record<string, unknown>)?.text || "",
            chunkIndex: (c.metadata as Record<string, unknown>)?.chunkIndex ?? null,
            metadata: c.metadata || {},
            vectorPreview: c.vector_preview || [],
            vectorDimensions: c.vector_dims || 0
        }));

        return NextResponse.json({
            documentId: decodedDocId,
            sourceName: summaryResult[0]?.source_name || decodedDocId,
            firstIngestedAt: summaryResult[0]?.first_ingested || null,
            lastIngestedAt: summaryResult[0]?.last_ingested || null,
            managedDocument: managedDoc,
            chunks: formattedChunks,
            total: totalChunks,
            page,
            pageSize,
            totalPages: Math.ceil(totalChunks / pageSize)
        });
    } catch (error) {
        console.error("Get vector chunks error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to get vector chunks"
            },
            { status: 500 }
        );
    }
}
