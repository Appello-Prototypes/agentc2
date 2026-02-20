import { NextRequest, NextResponse } from "next/server";
import { getAiProviderStatus } from "@repo/agentc2/agents";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/integrations/ai-providers/status
 *
 * Returns the status of AI model provider API key connections
 * for the current user's organization.
 *
 * Response: { providers: { openai: { hasOrgKey, hasEnvKey, connected }, ... } }
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = authContext.organizationId;
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const providers = await getAiProviderStatus(organizationId);

        return NextResponse.json({ success: true, providers });
    } catch (error) {
        console.error("[AI Providers Status] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get AI provider status"
            },
            { status: 500 }
        );
    }
}
