import { NextRequest, NextResponse } from "next/server";
import { getVoiceService } from "../_service";
import { prisma } from "@repo/database";

/**
 * POST /api/channels/voice/gather
 *
 * Handle speech input from Twilio Gather.
 * Processes the speech and returns TwiML with agent response.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const callSid = formData.get("CallSid") as string;
        const speechResult = formData.get("SpeechResult") as string;
        const confidence = formData.get("Confidence") as string;

        console.log(
            `[Voice] Speech from ${callSid}: "${speechResult}" (confidence: ${confidence})`
        );

        if (!speechResult || speechResult.trim() === "") {
            const webhookUrl = process.env.VOICE_WEBHOOK_URL || "";
            const gatherUrl = `${webhookUrl}/gather?callSid=${callSid}`;

            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">I didn't catch that. Could you please repeat?</Say>
    <Gather input="speech" timeout="5" action="${gatherUrl}" method="POST">
        <Say voice="Polly.Joanna">I'm listening.</Say>
    </Gather>
    <Say voice="Polly.Joanna">I still didn't hear anything. Goodbye!</Say>
    <Hangup/>
</Response>`;

            return new NextResponse(twiml, {
                headers: { "Content-Type": "application/xml" }
            });
        }

        // Update call log with transcript
        await prisma.voiceCallLog.updateMany({
            where: { callSid },
            data: {
                transcript: speechResult
            }
        });

        // Get agent response
        const service = await getVoiceService();
        const { twiml } = await service.handleSpeechInput(callSid, speechResult);

        return new NextResponse(twiml, {
            headers: { "Content-Type": "application/xml" }
        });
    } catch (error) {
        console.error("[Voice] Gather error:", error);
        return new NextResponse(
            `<Response>
                <Say voice="Polly.Joanna">I'm sorry, I encountered an error. Please try again later.</Say>
                <Hangup/>
            </Response>`,
            { headers: { "Content-Type": "application/xml" } }
        );
    }
}
