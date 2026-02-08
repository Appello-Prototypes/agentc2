import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { analyzeMcpConfigImpact } from "@repo/mastra";
import { getUserOrganizationId } from "@/lib/organization";
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
        const config =
            body && typeof body === "object" && "mcpServers" in body ? body : body?.config;
        const mode = body?.mode === "merge" ? "merge" : "replace";

        const impact = await analyzeMcpConfigImpact({
            organizationId,
            userId: session.user.id,
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
