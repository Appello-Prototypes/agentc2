import { NextRequest, NextResponse } from "next/server";
import { getVoiceService } from "../_service";
import { prisma } from "@repo/database";

/**
 * POST /api/channels/voice/webhook
 *
 * Handle Twilio voice webhooks for incoming calls.
 * Returns TwiML for call handling.
 */
export async function POST(request: NextRequest) {
    try {
        // Parse form data from Twilio
        const formData = await request.formData();
        const callSid = formData.get("CallSid") as string;
        const from = formData.get("From") as string;
        const to = formData.get("To") as string;
        const callStatus = formData.get("CallStatus") as string;
        const direction = formData.get("Direction") as string;

        console.log(
            `[Voice] Webhook: ${direction} call ${callSid} from ${from} to ${to} - ${callStatus}`
        );

        const service = await getVoiceService();

        // Handle incoming call
        if (direction === "inbound" && callStatus === "ringing") {
            const { twiml } = await service.handleIncomingCall(from, to, callSid);

            // Log the call
            await prisma.voiceCallLog.create({
                data: {
                    callSid,
                    direction: "inbound",
                    fromNumber: from,
                    toNumber: to,
                    status: "ringing",
                    agentSlug: process.env.VOICE_DEFAULT_AGENT_SLUG || "mcp-agent"
                }
            });

            return new NextResponse(twiml, {
                headers: { "Content-Type": "application/xml" }
            });
        }

        // Handle status updates
        service.handleStatusUpdate(callSid, callStatus);

        // Update call log
        const updateData: Record<string, unknown> = { status: callStatus };
        if (
            callStatus === "completed" ||
            callStatus === "failed" ||
            callStatus === "busy" ||
            callStatus === "no-answer"
        ) {
            updateData.endedAt = new Date();
            const duration = formData.get("CallDuration");
            if (duration) {
                updateData.duration = parseInt(duration as string, 10);
            }
            const recordingUrl = formData.get("RecordingUrl");
            if (recordingUrl) {
                updateData.recordingUrl = recordingUrl as string;
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
        console.error("[Voice] Webhook error:", error);
        return new NextResponse(
            `<Response><Say>Sorry, an error occurred.</Say><Hangup/></Response>`,
            { headers: { "Content-Type": "application/xml" } }
        );
    }
}
