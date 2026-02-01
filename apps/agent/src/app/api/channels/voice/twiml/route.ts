import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/channels/voice/twiml
 *
 * Generate TwiML for initial call greeting.
 * Called by Twilio when a call connects.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const greeting =
            searchParams.get("greeting") ||
            "Hello! I'm your AI assistant. How can I help you today?";
        const callSid = searchParams.get("CallSid") || "unknown";

        const webhookUrl = process.env.VOICE_WEBHOOK_URL || "";
        const gatherUrl = `${webhookUrl}/gather?callSid=${callSid}`;

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">${escapeXml(greeting)}</Say>
    <Gather input="speech" timeout="5" action="${gatherUrl}" method="POST">
        <Say voice="Polly.Joanna">Please tell me what you need.</Say>
    </Gather>
    <Say voice="Polly.Joanna">I didn't hear anything. Goodbye!</Say>
    <Hangup/>
</Response>`;

        return new NextResponse(twiml, {
            headers: { "Content-Type": "application/xml" }
        });
    } catch (error) {
        console.error("[Voice] TwiML generation error:", error);
        return new NextResponse(
            `<Response><Say>Sorry, an error occurred.</Say><Hangup/></Response>`,
            { headers: { "Content-Type": "application/xml" } }
        );
    }
}

/**
 * POST /api/channels/voice/twiml
 *
 * Handle POST requests from Twilio (form data).
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const callSid = formData.get("CallSid") as string;

        const { searchParams } = new URL(request.url);
        const greeting =
            searchParams.get("greeting") ||
            "Hello! I'm your AI assistant. How can I help you today?";

        const webhookUrl = process.env.VOICE_WEBHOOK_URL || "";
        const gatherUrl = `${webhookUrl}/gather?callSid=${callSid}`;

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">${escapeXml(greeting)}</Say>
    <Gather input="speech" timeout="5" action="${gatherUrl}" method="POST">
        <Say voice="Polly.Joanna">Please tell me what you need.</Say>
    </Gather>
    <Say voice="Polly.Joanna">I didn't hear anything. Goodbye!</Say>
    <Hangup/>
</Response>`;

        return new NextResponse(twiml, {
            headers: { "Content-Type": "application/xml" }
        });
    } catch (error) {
        console.error("[Voice] TwiML POST error:", error);
        return new NextResponse(
            `<Response><Say>Sorry, an error occurred.</Say><Hangup/></Response>`,
            { headers: { "Content-Type": "application/xml" } }
        );
    }
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
