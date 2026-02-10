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
    try {
        // Try to authenticate to get org context (optional - env fallback works without auth)
        let organizationId: string | undefined;
        try {
            const authContext = await authenticateRequest(request);
            organizationId = authContext?.organizationId;
        } catch {
            // Auth failed - continue with env-only mode
        }

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
