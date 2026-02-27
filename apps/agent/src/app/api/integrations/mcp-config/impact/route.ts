import { NextRequest, NextResponse } from "next/server";
import { analyzeMcpConfigImpact } from "@repo/agentc2/mcp";
import { requireUserWithOrg } from "@/lib/authz/require-auth";

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireUserWithOrg();
        if (authResult.response) return authResult.response;

        const { userId, organizationId } = authResult.context;

        const body = await request.json();
        const config =
            body && typeof body === "object" && "mcpServers" in body ? body : body?.config;
        const mode = body?.mode === "merge" ? "merge" : "replace";

        const impact = await analyzeMcpConfigImpact({
            organizationId,
            userId,
            config,
            mode
        });

        return NextResponse.json({ success: true, impact });
    } catch (error) {
        console.error("[MCP Config] Impact analysis error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to analyze MCP config"
            },
            { status: 500 }
        );
    }
}
