import { NextRequest, NextResponse } from "next/server";
import { exportMcpConfig, importMcpConfig } from "@repo/agentc2/mcp";
import { requireUserWithOrg } from "@/lib/authz/require-auth";

/**
 * GET /api/integrations/mcp-config
 *
 * Export current MCP configuration as Cursor-compatible JSON.
 */
export async function GET() {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const config = await exportMcpConfig({
            organizationId,
            userId
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
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const body = await request.json();
        const config =
            body && typeof body === "object" && "mcpServers" in body ? body : body?.config;
        const mode = body?.mode === "merge" ? "merge" : "replace";

        const result = await importMcpConfig({
            organizationId,
            userId,
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
