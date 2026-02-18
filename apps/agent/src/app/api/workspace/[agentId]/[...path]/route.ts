import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { getUserOrganizationId } from "@/lib/organization";
import { WORKSPACE_CSP } from "@/lib/workspace-csp";
import { readFile, stat, realpath } from "fs/promises";
import { join, normalize, isAbsolute, extname, resolve } from "path";

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

function resolveAndValidate(
    agentId: string,
    filePath: string,
    organizationId?: string
): string | null {
    const decodedPath = decodeURIComponent(filePath);
    if (isAbsolute(decodedPath)) return null;

    const normalized = normalize(decodedPath);
    if (
        normalized.startsWith("..") ||
        normalized.includes("/../") ||
        normalized.includes("\\..\\") ||
        normalized.includes("/..\\") ||
        normalized.includes("\\../")
    )
        return null;
    if (normalized.startsWith(".tmp_exec_")) return null;

    const workspaceDir = organizationId
        ? join(WORKSPACE_ROOT, organizationId, agentId)
        : join(WORKSPACE_ROOT, agentId);
    const resolvedPath = resolve(workspaceDir, normalized);
    const workspacePrefix = workspaceDir.endsWith("/") ? workspaceDir : `${workspaceDir}/`;

    if (resolvedPath !== workspaceDir && !resolvedPath.startsWith(workspacePrefix)) return null;

    return resolvedPath;
}

/**
 * Verify that the authenticated user's organization owns the agent.
 * Returns null if ownership cannot be verified (agent has no org — allow access).
 * Returns false if the agent belongs to a different org.
 */
async function verifyAgentOrgOwnership(
    agentSlug: string,
    userOrgId: string
): Promise<boolean | null> {
    const agent = await prisma.agent.findFirst({
        where: { slug: agentSlug },
        select: {
            tenantId: true,
            workspace: { select: { organizationId: true } }
        }
    });

    if (!agent) return null;

    const agentOrgId = agent.workspace?.organizationId || agent.tenantId;
    if (!agentOrgId) return null;

    return agentOrgId === userOrgId;
}

/**
 * GET /api/workspace/[agentId]/[...path]
 * Serves files from an agent's workspace directory for browser preview.
 * Enforces org-scoped access: users can only view files from agents in their org.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agentId: string; path: string[] }> }
) {
    try {
        const apiAuth = await authenticateRequest(request);
        let userId = apiAuth?.userId;
        let organizationId = apiAuth?.organizationId;

        if (!userId) {
            const session = await auth.api.getSession({
                headers: await headers()
            });
            userId = session?.user?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!organizationId) {
            organizationId = (await getUserOrganizationId(userId)) ?? undefined;
        }

        if (!organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { agentId, path: pathSegments } = await params;
        const filePath = pathSegments.join("/");

        const ownershipResult = await verifyAgentOrgOwnership(agentId, organizationId);
        if (ownershipResult === false) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Try org-prefixed path first, fall back to legacy flat path for migration compat
        let resolved = resolveAndValidate(agentId, filePath, organizationId);
        let fileStat = resolved ? await stat(resolved).catch(() => null) : null;

        if (!fileStat || !fileStat.isFile()) {
            resolved = resolveAndValidate(agentId, filePath);
            fileStat = resolved ? await stat(resolved).catch(() => null) : null;
        }

        if (!resolved) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }

        const realResolved = await realpath(resolved).catch(() => null);
        if (!realResolved) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
        const expectedWorkspaceRoot = organizationId
            ? join(WORKSPACE_ROOT, organizationId, agentId)
            : join(WORKSPACE_ROOT, agentId);
        const workspaceRealPath = await realpath(expectedWorkspaceRoot).catch(() => null);
        if (!workspaceRealPath) {
            return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
        }
        const workspacePrefix = workspaceRealPath.endsWith("/")
            ? workspaceRealPath
            : `${workspaceRealPath}/`;
        if (realResolved !== workspaceRealPath && !realResolved.startsWith(workspacePrefix)) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }

        if (!fileStat || !fileStat.isFile()) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        if (fileStat.size > MAX_SERVE_SIZE) {
            return NextResponse.json({ error: "File too large to serve" }, { status: 413 });
        }

        const content = await readFile(realResolved);
        const ext = extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        const responseHeaders: Record<string, string> = {
            "Content-Type": contentType,
            "Content-Length": String(content.length),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff"
        };

        if (ext === ".html" || ext === ".htm") {
            responseHeaders["Content-Security-Policy"] = WORKSPACE_CSP;
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
