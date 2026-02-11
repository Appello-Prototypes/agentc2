import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { testMcpServer } from "@repo/mastra";
import { getUserOrganizationId } from "@/lib/organization";

/**
 * POST /api/integrations/mcp-config/test-all
 *
 * Test all specified MCP servers in parallel.
 * Body: { serverKeys: string[] }
 * Returns per-server test results.
 */
export async function POST(request: NextRequest) {
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
                    userId: session.user.id,
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
