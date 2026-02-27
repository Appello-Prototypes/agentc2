import { NextRequest, NextResponse } from "next/server";
import { testMcpServer } from "@repo/agentc2/mcp";
import { requireUserWithOrg } from "@/lib/authz/require-auth";

/**
 * POST /api/integrations/mcp-config/test-all
 *
 * Test all specified MCP servers in parallel.
 * Body: { serverKeys: string[] }
 * Returns per-server test results.
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const body = await request.json();
        const serverKeys: string[] = Array.isArray(body?.serverKeys) ? body.serverKeys : [];

        if (serverKeys.length === 0) {
            return NextResponse.json({ success: true, results: {} });
        }

        const results = await Promise.allSettled(
            serverKeys.map(async (serverKey) => {
                const timeoutMs = serverKey === "atlas" ? 60000 : 30000;
                const result = await testMcpServer({
                    serverId: serverKey,
                    organizationId,
                    userId,
                    allowEnvFallback: false,
                    timeoutMs
                });
                return { serverKey, result };
            })
        );

        const serverResults: Record<
            string,
            { success: boolean; toolCount?: number; error?: string }
        > = {};

        for (const settled of results) {
            if (settled.status === "fulfilled") {
                const { serverKey, result } = settled.value;
                const lastPhase = result.phases[result.phases.length - 1];
                serverResults[serverKey] = {
                    success: result.success,
                    toolCount: result.toolCount,
                    error: result.success ? undefined : lastPhase?.detail
                };
            } else {
                // Extract serverKey from the index
                const idx = results.indexOf(settled);
                const key = serverKeys[idx]!;
                serverResults[key] = {
                    success: false,
                    error:
                        settled.reason instanceof Error ? settled.reason.message : "Unknown error"
                };
            }
        }

        return NextResponse.json({ success: true, results: serverResults });
    } catch (error) {
        console.error("[MCP Config Test All] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to test MCP servers"
            },
            { status: 500 }
        );
    }
}
