import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getVoiceService, isVoiceInitialized } from "../_service";

/**
 * GET /api/channels/voice/status
 *
 * Get voice channel status.
 */
export async function GET() {
    try {
        const enabled = process.env.TWILIO_ENABLED === "true";

        if (!enabled) {
            return NextResponse.json({
                enabled: false,
                status: "disabled",
                message: "Voice channel is disabled"
            });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !phoneNumber) {
            return NextResponse.json({
                enabled: true,
                status: "error",
                message: "Twilio credentials not configured"
            });
        }

        if (!isVoiceInitialized()) {
            return NextResponse.json({
                enabled: true,
                status: "not_initialized",
                message: "Voice service not initialized"
            });
        }

        const service = await getVoiceService();
        const status = service.getStatus();
        const activeCalls = service.getActiveCalls();

        // Get call statistics
        const callStats = await prisma.voiceCallLog.groupBy({
            by: ["status"],
            _count: true
        });

        const totalCalls = await prisma.voiceCallLog.count();
        const recentCalls = await prisma.voiceCallLog.findMany({
            orderBy: { startedAt: "desc" },
            take: 5,
            select: {
                callSid: true,
                direction: true,
                fromNumber: true,
                toNumber: true,
                status: true,
                duration: true,
                startedAt: true
            }
        });

        return NextResponse.json({
            enabled: true,
            status,
            connected: status === "connected",
            config: {
                phoneNumber,
                defaultAgentSlug: process.env.VOICE_DEFAULT_AGENT_SLUG || "mcp-agent",
                ttsProvider: process.env.VOICE_TTS_PROVIDER || "twilio",
                webhookUrl: process.env.VOICE_WEBHOOK_URL
            },
            activeCalls: activeCalls.length,
            stats: {
                total: totalCalls,
                byStatus: Object.fromEntries(callStats.map((s) => [s.status, s._count]))
            },
            recentCalls
        });
    } catch (error) {
        console.error("[Voice] Status error:", error);
        return NextResponse.json(
            {
                enabled: true,
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/channels/voice/status
 *
 * Handle call status updates from Twilio (webhook for outbound calls).
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const callSid = formData.get("CallSid") as string;
        const callStatus = formData.get("CallStatus") as string;

        console.log(`[Voice] Status update for ${callSid}: ${callStatus}`);

        const service = await getVoiceService();
        service.handleStatusUpdate(callSid, callStatus);

        // Update database
        const updateData: Record<string, unknown> = { status: callStatus };
        if (["completed", "failed", "busy", "no-answer", "canceled"].includes(callStatus)) {
            updateData.endedAt = new Date();
            const duration = formData.get("CallDuration");
            if (duration) {
                updateData.duration = parseInt(duration as string, 10);
            }
        }

        await prisma.voiceCallLog.updateMany({
            where: { callSid },
            data: updateData
        });

        return new NextResponse("<Response></Response>", {
            headers: { "Content-Type": "application/xml" }
        });
    } catch (error) {
        console.error("[Voice] Status update error:", error);
        return new NextResponse("<Response></Response>", {
            headers: { "Content-Type": "application/xml" }
        });
    }
}
