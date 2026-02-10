import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { createDocumentRecord, type CreateDocumentInput } from "@repo/mastra";
import { authenticateRequest } from "@/lib/api-auth";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";
import { PDFParse } from "pdf-parse";

/**
 * Map file extension to the contentType expected by the document service.
 */
function extensionToContentType(ext: string): "text" | "markdown" | "html" | "json" {
    switch (ext.toLowerCase()) {
        case ".md":
        case ".markdown":
            return "markdown";
        case ".html":
        case ".htm":
            return "html";
        case ".json":
            return "json";
        default:
            return "text";
    }
}

/**
 * Generate a URL-safe slug from a filename.
 */
function filenameToSlug(filename: string): string {
    return filename
        .replace(/\.[^.]+$/, "") // strip extension
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * POST /api/documents/upload
 *
 * Accepts multipart/form-data with:
 *   - file: the uploaded file (required)
 *   - name: display name (optional, defaults to filename)
 *   - slug: URL-safe identifier (optional, derived from filename)
 *   - description: brief description (optional)
 *   - category: category string (optional)
 *   - tags: comma-separated tags (optional)
 *   - contentType: override content type detection (optional)
 *
 * Supported file types: .txt, .md, .json, .html, .csv, .pdf
 */
export async function POST(request: NextRequest) {
    try {
        // --- Authentication ---
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

        // --- Parse multipart form data ---
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { error: "A file is required in the 'file' field" },
                { status: 400 }
            );
        }

        const filename = file.name;
        const ext = filename.includes(".") ? "." + filename.split(".").pop()!.toLowerCase() : "";

        const allowedExtensions = [
            ".txt",
            ".md",
            ".markdown",
            ".json",
            ".html",
            ".htm",
            ".csv",
            ".pdf"
        ];
        if (ext && !allowedExtensions.includes(ext)) {
            return NextResponse.json(
                {
                    error: `Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(", ")}`
                },
                { status: 400 }
            );
        }

        // --- Extract text content ---
        let content: string;

        if (ext === ".pdf") {
            const arrayBuffer = await file.arrayBuffer();
            const parser = new PDFParse({ data: arrayBuffer });
            const textResult = await parser.getText();
            content = textResult.text;
            await parser.destroy();
        } else {
            content = await file.text();
        }

        if (!content || content.trim().length === 0) {
            return NextResponse.json(
                { error: "File is empty or could not be parsed" },
                { status: 400 }
            );
        }

        // --- Resolve metadata from form fields ---
        const nameField = (formData.get("name") as string) || filename.replace(/\.[^.]+$/, "");
        const slugField = (formData.get("slug") as string) || filenameToSlug(filename);
        const description = (formData.get("description") as string) || undefined;
        const category = (formData.get("category") as string) || undefined;
        const tagsRaw = (formData.get("tags") as string) || "";
        const tags = tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        const contentTypeOverride = formData.get("contentType") as string | null;
        const contentType = contentTypeOverride || extensionToContentType(ext);

        const workspaceId = (await getDefaultWorkspaceIdForUser(userId)) || undefined;

        // --- Create document via existing service ---
        const input: CreateDocumentInput = {
            slug: slugField,
            name: nameField,
            description,
            content,
            contentType: contentType as "text" | "markdown" | "html" | "json",
            category,
            tags: tags.length > 0 ? tags : undefined,
            workspaceId,
            type: "USER",
            createdBy: userId
        };

        const document = await createDocumentRecord(input);

        return NextResponse.json(document, { status: 201 });
    } catch (error) {
        console.error("Document upload error:", error);
        const message = error instanceof Error ? error.message : "Failed to upload document";
        const status = message.includes("already exists") ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
