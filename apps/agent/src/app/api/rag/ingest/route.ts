import { NextRequest, NextResponse } from "next/server";
import { createDocumentRecord, type CreateDocumentInput } from "@repo/mastra/documents";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const {
            content,
            type,
            sourceId,
            sourceName,
            chunkOptions,
            description,
            category,
            tags,
            workspaceId,
            onConflict
        } = await req.json();

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        const slug = sourceId || `doc-${Date.now()}`;
        const name = sourceName || slug;

        const input: CreateDocumentInput = {
            slug,
            name,
            content,
            description,
            contentType: type || "markdown",
            category,
            tags,
            workspaceId,
            chunkOptions,
            onConflict: onConflict || "skip",
            createdBy: session.user.id
        };

        const result = await createDocumentRecord(input);

        return NextResponse.json(result);
    } catch (error) {
        console.error("RAG ingest error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Ingest failed" },
            { status: 500 }
        );
    }
}
