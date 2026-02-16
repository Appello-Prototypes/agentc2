import { NextRequest, NextResponse } from "next/server";
import { ingestDocument, type ChunkOptions } from "@repo/mastra/rag";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { content, type, sourceId, sourceName, chunkOptions } = await req.json();

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        const result = await ingestDocument(content, {
            type: type || "text",
            sourceId,
            sourceName,
            chunkOptions: chunkOptions as ChunkOptions
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("RAG ingest error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Ingest failed" },
            { status: 500 }
        );
    }
}
