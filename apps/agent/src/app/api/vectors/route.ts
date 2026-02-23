import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

interface VectorGroup {
    documentId: string;
    sourceName: string;
    chunkCount: number;
    firstIngestedAt: string;
    lastIngestedAt: string;
    hasDocumentRecord: boolean;
    sampleText: string;
}

/**
 * GET /api/vectors
 *
 * List vector store entries grouped by documentId with pagination.
 * Queries the raw rag_documents table (managed by @mastra/pg).
 *
 * Query params:
 *   - page (default 1)
 *   - pageSize (default 25, max 100)
 *   - search (filter by documentId or sourceName)
 *   - orphansOnly (only show vectors without a Document record)
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

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const pageSize = Math.min(
            100,
            Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
        );
        const search = searchParams.get("search")?.trim() || "";
        const orphansOnly = searchParams.get("orphansOnly") === "true";
        const offset = (page - 1) * pageSize;

        const searchCondition = search
            ? `AND (metadata->>'documentId' ILIKE $1 OR metadata->>'sourceName' ILIKE $1)`
            : "";
        const searchParam = search ? `%${search}%` : null;

        // Get grouped vector entries
        const countQuery = searchParam
            ? prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
                  `SELECT count(DISTINCT metadata->>'documentId') as cnt FROM rag_documents WHERE metadata->>'documentId' IS NOT NULL ${searchCondition}`,
                  searchParam
              )
            : prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
                  `SELECT count(DISTINCT metadata->>'documentId') as cnt FROM rag_documents WHERE metadata->>'documentId' IS NOT NULL`
              );

        const groupsQuery = searchParam
            ? prisma.$queryRawUnsafe<
                  Array<{
                      document_id: string;
                      source_name: string;
                      chunk_count: bigint;
                      first_ingested: string;
                      last_ingested: string;
                      sample_text: string;
                  }>
              >(
                  `SELECT 
                      metadata->>'documentId' as document_id,
                      COALESCE(MAX(metadata->>'sourceName'), metadata->>'documentId') as source_name,
                      count(*) as chunk_count,
                      MIN(metadata->>'ingestedAt') as first_ingested,
                      MAX(metadata->>'ingestedAt') as last_ingested,
                      (array_agg(LEFT(metadata->>'text', 200) ORDER BY (metadata->>'chunkIndex')::int))[1] as sample_text
                  FROM rag_documents
                  WHERE metadata->>'documentId' IS NOT NULL ${searchCondition}
                  GROUP BY metadata->>'documentId'
                  ORDER BY MAX(metadata->>'ingestedAt') DESC NULLS LAST
                  LIMIT ${pageSize} OFFSET ${offset}`,
                  searchParam
              )
            : prisma.$queryRawUnsafe<
                  Array<{
                      document_id: string;
                      source_name: string;
                      chunk_count: bigint;
                      first_ingested: string;
                      last_ingested: string;
                      sample_text: string;
                  }>
              >(
                  `SELECT 
                      metadata->>'documentId' as document_id,
                      COALESCE(MAX(metadata->>'sourceName'), metadata->>'documentId') as source_name,
                      count(*) as chunk_count,
                      MIN(metadata->>'ingestedAt') as first_ingested,
                      MAX(metadata->>'ingestedAt') as last_ingested,
                      (array_agg(LEFT(metadata->>'text', 200) ORDER BY (metadata->>'chunkIndex')::int))[1] as sample_text
                  FROM rag_documents
                  WHERE metadata->>'documentId' IS NOT NULL
                  GROUP BY metadata->>'documentId'
                  ORDER BY MAX(metadata->>'ingestedAt') DESC NULLS LAST
                  LIMIT ${pageSize} OFFSET ${offset}`
              );

        const [countResult, rawGroups] = await Promise.all([countQuery, groupsQuery]);

        const totalGroups = Number(countResult[0]?.cnt || 0);

        // Check which documentIds have a corresponding Document record
        const documentIds = rawGroups.map((g) => g.document_id);
        const existingDocs =
            documentIds.length > 0
                ? await prisma.document.findMany({
                      where: { slug: { in: documentIds } },
                      select: { slug: true }
                  })
                : [];
        const existingSlugs = new Set(existingDocs.map((d) => d.slug));

        let groups: VectorGroup[] = rawGroups.map((g) => ({
            documentId: g.document_id,
            sourceName: g.source_name || g.document_id,
            chunkCount: Number(g.chunk_count),
            firstIngestedAt: g.first_ingested || "",
            lastIngestedAt: g.last_ingested || "",
            hasDocumentRecord: existingSlugs.has(g.document_id),
            sampleText: g.sample_text || ""
        }));

        if (orphansOnly) {
            groups = groups.filter((g) => !g.hasDocumentRecord);
        }

        return NextResponse.json({
            groups,
            total: orphansOnly ? groups.length : totalGroups,
            page,
            pageSize,
            totalPages: Math.ceil(totalGroups / pageSize)
        });
    } catch (error) {
        console.error("List vectors error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list vectors" },
            { status: 500 }
        );
    }
}
