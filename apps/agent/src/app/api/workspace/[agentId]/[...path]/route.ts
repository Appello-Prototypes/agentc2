import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { authenticateRequest } from "@/lib/api-auth";
import { readFile, stat } from "fs/promises";
import { join, normalize, isAbsolute, extname } from "path";

const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT || "/var/lib/agentc2/workspaces";

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".xml": "application/xml",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".pdf": "application/pdf"
};

const MAX_SERVE_SIZE = 5_242_880; // 5MB

function resolveAndValidate(agentId: string, filePath: string): string | null {
    if (isAbsolute(filePath)) return null;

    const normalized = normalize(filePath);
    if (normalized.startsWith("..") || normalized.includes("/../")) return null;
    if (normalized.startsWith(".tmp_exec_")) return null;

    const workspaceDir = join(WORKSPACE_ROOT, agentId);
    const resolved = join(workspaceDir, normalized);

    if (!resolved.startsWith(workspaceDir)) return null;

    return resolved;
}

/**
 * GET /api/workspace/[agentId]/[...path]
 * Serves files from an agent's workspace directory for browser preview.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agentId: string; path: string[] }> }
) {
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

        const { agentId, path: pathSegments } = await params;
        const filePath = pathSegments.join("/");

        const resolved = resolveAndValidate(agentId, filePath);
        if (!resolved) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }

        const fileStat = await stat(resolved).catch(() => null);
        if (!fileStat || !fileStat.isFile()) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        if (fileStat.size > MAX_SERVE_SIZE) {
            return NextResponse.json({ error: "File too large to serve" }, { status: 413 });
        }

        const content = await readFile(resolved);
        const ext = extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        const responseHeaders: Record<string, string> = {
            "Content-Type": contentType,
            "Content-Length": String(content.length),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff"
        };

        if (ext === ".html" || ext === ".htm") {
            responseHeaders["Content-Security-Policy"] = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com",
                "font-src 'self' data: https://fonts.gstatic.com",
                "img-src 'self' data: https:",
                "connect-src 'self' https:",
                "media-src 'self' data: blob:",
                "frame-ancestors 'self'"
            ].join("; ");
        }

        return new NextResponse(content, {
            status: 200,
            headers: responseHeaders
        });
    } catch (error) {
        console.error("Workspace serve error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to serve file"
            },
            { status: 500 }
        );
    }
}
