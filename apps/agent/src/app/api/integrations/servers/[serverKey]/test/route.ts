import { NextResponse } from "next/server";
import { testMcpServer } from "@repo/agentc2/mcp";
import { requireUserWithOrg } from "@/lib/authz/require-auth";

/**
 * POST /api/integrations/servers/[serverKey]/test
 *
 * Test a single MCP server and return phased results.
 */
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ serverKey: string }> }
) {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const { serverKey } = await params;
        const timeoutMs = serverKey === "atlas" ? 60000 : 30000;
        const result = await testMcpServer({
            serverId: serverKey,
            organizationId,
            userId,
            allowEnvFallback: true,
            timeoutMs
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("[Integrations Server Test] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to test server"
            },
            { status: 500 }
        );
    }
}
