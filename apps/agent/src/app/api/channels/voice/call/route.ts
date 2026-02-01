import { NextRequest, NextResponse } from "next/server";
import { getVoiceService } from "../_service";

/**
 * POST /api/channels/voice/call
 *
 * Initiate an outbound voice call.
 *
 * Body:
 * - to: string - Phone number to call (E.164 format, e.g., +15551234567)
 * - greeting?: string - Initial message to speak
 * - agentSlug?: string - Agent to handle the conversation
 * - maxDuration?: number - Maximum call duration in seconds
 */
export async function POST(request: NextRequest) {
    try {
        const enabled = process.env.TWILIO_ENABLED === "true";

        if (!enabled) {
            return NextResponse.json({ error: "Voice channel is disabled" }, { status: 400 });
        }

        const body = await request.json();
        const { to, greeting, agentSlug, maxDuration } = body;

        if (!to) {
            return NextResponse.json({ error: "Missing required field: to" }, { status: 400 });
        }

        // Validate phone number format
        if (!to.match(/^\+[1-9]\d{1,14}$/)) {
            return NextResponse.json(
                { error: "Invalid phone number format. Use E.164 format (e.g., +15551234567)" },
                { status: 400 }
            );
        }

        const service = await getVoiceService();
        const status = service.getStatus();

        if (status !== "connected") {
            return NextResponse.json(
                { error: `Voice service not connected (status: ${status})` },
                { status: 503 }
            );
        }

        const call = await service.initiateCall({
            to,
            greeting: greeting || "Hello! I'm your AI assistant. How can I help you today?",
            agentSlug,
            maxDuration
        });

        return NextResponse.json({
            success: true,
            callId: call.callId,
            status: call.status,
            from: call.from,
            to: call.to,
            direction: call.direction,
            startedAt: call.startedAt
        });
    } catch (error) {
        console.error("[Voice] Call initiation error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/channels/voice/call
 *
 * Get active calls.
 */
export async function GET() {
    try {
        const enabled = process.env.TWILIO_ENABLED === "true";

        if (!enabled) {
            return NextResponse.json({
                enabled: false,
                calls: []
            });
        }

        const service = await getVoiceService();
        const activeCalls = service.getActiveCalls();

        return NextResponse.json({
            enabled: true,
            calls: activeCalls
        });
    } catch (error) {
        console.error("[Voice] Get calls error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
