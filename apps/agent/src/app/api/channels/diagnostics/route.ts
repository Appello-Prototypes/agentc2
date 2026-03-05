import { NextRequest, NextResponse } from "next/server";
import { runAllDiagnostics } from "@/lib/channel-diagnostics";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/channels/diagnostics
 *
 * Run health checks across all voice/messaging integrations
 * (Twilio, ElevenLabs, Telegram, WhatsApp) and return structured pass/fail results.
 *
 * Authenticated: resolves credentials from the user's org first, then env fallback.
 * Unauthenticated: uses env vars only (backward compatible).
 */
export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const organizationId = authContext.organizationId;

        const results = await runAllDiagnostics(organizationId);
        return NextResponse.json(results);
    } catch (error) {
        console.error("[Diagnostics] Error running diagnostics:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}
