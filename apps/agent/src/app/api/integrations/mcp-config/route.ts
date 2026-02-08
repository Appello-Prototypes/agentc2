import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { exportMcpConfig, importMcpConfig } from "@repo/mastra";
import { getUserOrganizationId } from "@/lib/organization";

/**
 * GET /api/integrations/mcp-config
 *
 * Export current MCP configuration as Cursor-compatible JSON.
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const config = await exportMcpConfig({
            organizationId,
            userId: session.user.id
        });

        return NextResponse.json({ success: true, config });
    } catch (error) {
        console.error("[MCP Config] Export error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to export MCP config"
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/integrations/mcp-config
 *
 * Import MCP configuration JSON and sync to connections.
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const config =
            body && typeof body === "object" && "mcpServers" in body ? body : body?.config;
        const mode = body?.mode === "merge" ? "merge" : "replace";

        const result = await importMcpConfig({
            organizationId,
            userId: session.user.id,
            config,
            mode
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("[MCP Config] Import error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to import MCP config"
            },
            { status: 500 }
        );
    }
}
