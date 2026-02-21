import { NextRequest, NextResponse } from "next/server";
import { listDocuments, deleteDocument } from "@repo/agentc2/rag";
import { getDemoSession } from "@/lib/standalone-auth";

export async function GET(req: NextRequest) {
    try {
        const session = await getDemoSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = req.headers.get("x-organization-id") ?? undefined;
        const documents = await listDocuments(organizationId);
        return NextResponse.json({ documents });
    } catch (error) {
        console.error("RAG list documents error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list documents" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getDemoSession(req);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { documentId } = await req.json();

        if (!documentId) {
            return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
        }

        const organizationId = req.headers.get("x-organization-id") ?? undefined;
        await deleteDocument(documentId, organizationId);
        return NextResponse.json({ success: true, documentId });
    } catch (error) {
        console.error("RAG delete document error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete document" },
            { status: 500 }
        );
    }
}
