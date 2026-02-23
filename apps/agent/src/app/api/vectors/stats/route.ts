import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/vectors/stats
 *
 * Returns aggregate statistics for the knowledge base:
 * - Total managed documents (Document table)
 * - Total vector entries (rag_documents table)
 * - Total distinct document groups in vector store
 * - Orphaned vector groups (in vector store but no Document record)
 * - Total rag chunks (for full-text search)
 */
export async function GET(request: NextRequest) {
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

        const [documentCount, vectorCountResult, distinctGroupsResult, ragChunkCount] =
            await Promise.all([
                prisma.document.count(),
                prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
                    "SELECT count(*) as cnt FROM rag_documents"
                ),
                prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
                    "SELECT count(DISTINCT metadata->>'documentId') as cnt FROM rag_documents WHERE metadata->>'documentId' IS NOT NULL"
                ),
                prisma.ragChunk.count().catch(() => 0)
            ]);

        const totalVectors = Number(vectorCountResult[0]?.cnt || 0);
        const distinctGroups = Number(distinctGroupsResult[0]?.cnt || 0);

        // Count orphans: vector groups without a Document record
        const allVectorDocIds = await prisma.$queryRawUnsafe<Array<{ doc_id: string }>>(
            "SELECT DISTINCT metadata->>'documentId' as doc_id FROM rag_documents WHERE metadata->>'documentId' IS NOT NULL"
        );
        const vectorDocIdList = allVectorDocIds.map((r) => r.doc_id);

        let orphanCount = 0;
        if (vectorDocIdList.length > 0) {
            const matchedDocs = await prisma.document.findMany({
                where: { slug: { in: vectorDocIdList } },
                select: { slug: true }
            });
            orphanCount = vectorDocIdList.length - matchedDocs.length;
        }

        return NextResponse.json({
            documents: documentCount,
            totalVectors,
            vectorGroups: distinctGroups,
            orphanGroups: orphanCount,
            ragChunks: ragChunkCount
        });
    } catch (error) {
        console.error("Vector stats error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get stats" },
            { status: 500 }
        );
    }
}
