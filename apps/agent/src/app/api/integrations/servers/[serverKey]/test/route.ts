import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { testMcpServer } from "@repo/mastra";
import { getUserOrganizationId } from "@/lib/organization";

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

        const { serverKey } = await params;
        const result = await testMcpServer({
            serverId: serverKey,
            organizationId,
            userId: session.user.id,
            allowEnvFallback: true,
            timeoutMs: 10000
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
