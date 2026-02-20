import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import {
    createDocumentRecord,
    listDocumentRecords,
    type CreateDocumentInput
} from "@repo/agentc2/documents";
import { authenticateRequest } from "@/lib/api-auth";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";

/**
 * GET /api/documents
 *
 * List documents with optional filters: category, tags, type, workspaceId
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
        const category = searchParams.get("category") || undefined;
        const type = (searchParams.get("type") as "USER" | "SYSTEM") || undefined;
        const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
        const skip = parseInt(searchParams.get("skip") || "0", 10);
        const take = parseInt(searchParams.get("take") || "50", 10);

        const workspaceId =
            searchParams.get("workspaceId") ||
            (await getDefaultWorkspaceIdForUser(userId)) ||
            undefined;

        const result = await listDocumentRecords({
            workspaceId,
            category,
            type,
            tags,
            skip,
            take
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("List documents error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list documents" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/documents
 *
 * Create a new document with automatic RAG embedding
 */
export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const {
            slug,
            name,
            content,
            description,
            contentType,
            category,
            tags,
            metadata,
            type,
            chunkOptions
        } = body;

        if (!slug || !name || !content) {
            return NextResponse.json(
                { error: "slug, name, and content are required" },
                { status: 400 }
            );
        }

        const workspaceId =
            body.workspaceId || (await getDefaultWorkspaceIdForUser(userId)) || undefined;

        const input: CreateDocumentInput = {
            slug,
            name,
            description,
            content,
            contentType,
            category,
            tags,
            metadata,
            workspaceId,
            type,
            createdBy: userId,
            chunkOptions
        };

        const document = await createDocumentRecord(input);

        return NextResponse.json(document, { status: 201 });
    } catch (error) {
        console.error("Create document error:", error);
        const message = error instanceof Error ? error.message : "Failed to create document";
        const status = message.includes("already exists") ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
