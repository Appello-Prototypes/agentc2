import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDocumentRecord, type CreateDocumentInput } from "@repo/agentc2/documents";
import { getDemoSession } from "@/lib/standalone-auth";
import { getUserOrganizationId } from "@/lib/organization";

const ragIngestSchema = z.object({
    content: z.string().min(1).max(5_000_000),
    type: z.enum(["text", "markdown", "html", "json"]).optional(),
    sourceId: z.string().max(500).optional(),
    sourceName: z.string().max(500).optional(),
    description: z.string().max(2000).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    workspaceId: z.string().max(100).optional(),
    onConflict: z.enum(["skip", "update", "error"]).optional(),
    chunkOptions: z
        .object({
            size: z.number().int().min(100).max(10000).optional(),
            overlap: z.number().int().min(0).max(2000).optional()
        })
        .optional()
});

export async function POST(req: NextRequest) {
    try {
        const session = await getDemoSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);

        const body = ragIngestSchema.safeParse(await req.json());
        if (!body.success) {
            return NextResponse.json(
                { error: "Invalid input", details: body.error.flatten().fieldErrors },
                { status: 400 }
            );
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
        } = body.data;

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
            organizationId: organizationId || undefined,
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
