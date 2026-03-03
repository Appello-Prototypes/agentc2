import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { getUserOrganizationId } from "@/lib/organization";

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

        const [documentCount, vectorCountResult, distinctGroupsResult, ragChunkCount] =
            await Promise.all([
                prisma.document.count({ where: { organizationId } }),
                prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
                    "SELECT count(*) as cnt FROM rag_documents WHERE metadata->>'organizationId' = $1",
                    organizationId
                ),
                prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
                    "SELECT count(DISTINCT metadata->>'documentId') as cnt FROM rag_documents WHERE metadata->>'documentId' IS NOT NULL AND metadata->>'organizationId' = $1",
                    organizationId
                ),
                prisma.ragChunk.count({ where: { organizationId } }).catch(() => 0)
            ]);

        const totalVectors = Number(vectorCountResult[0]?.cnt || 0);
        const distinctGroups = Number(distinctGroupsResult[0]?.cnt || 0);

        const allVectorDocIds = await prisma.$queryRawUnsafe<Array<{ doc_id: string }>>(
            "SELECT DISTINCT metadata->>'documentId' as doc_id FROM rag_documents WHERE metadata->>'documentId' IS NOT NULL AND metadata->>'organizationId' = $1",
            organizationId
        );
        const vectorDocIdList = allVectorDocIds.map((r) => r.doc_id);

        let orphanCount = 0;
        if (vectorDocIdList.length > 0) {
            const matchedDocs = await prisma.document.findMany({
                where: { slug: { in: vectorDocIdList }, organizationId },
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
