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
        const mode = searchParams.get("mode") || "gather";
        const agentId =
            searchParams.get("agentId") ||
            process.env.ELEVENLABS_MCP_AGENT_ID ||
            process.env.ELEVENLABS_AGENT_ID ||
            "";

        const twiml = buildTwiml({
            greeting,
            callSid,
            mode,
            agentId
        });

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
        const mode = searchParams.get("mode") || "gather";
        const agentId =
            searchParams.get("agentId") ||
            process.env.ELEVENLABS_MCP_AGENT_ID ||
            process.env.ELEVENLABS_AGENT_ID ||
            "";

        const twiml = buildTwiml({
            greeting,
            callSid,
            mode,
            agentId
        });

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

function buildTwiml(options: {
    greeting: string;
    callSid: string;
    mode: string;
    agentId: string;
}): string {
    if (options.mode === "stream") {
        const streamUrl = process.env.VOICE_STREAM_WS_URL;
        if (!streamUrl) {
            return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">Voice streaming is not configured. Please try again later.</Say>
    <Hangup/>
</Response>`;
        }

        const streamName = options.callSid ? `voice-stream-${options.callSid}` : "voice-stream";
        const authToken = process.env.VOICE_STREAM_AUTH_TOKEN || "";

        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${escapeXml(streamUrl)}" name="${escapeXml(streamName)}">
            ${options.agentId ? `<Parameter name="agentId" value="${escapeXml(options.agentId)}"/>` : ""}
            ${options.callSid ? `<Parameter name="callSid" value="${escapeXml(options.callSid)}"/>` : ""}
            ${authToken ? `<Parameter name="token" value="${escapeXml(authToken)}"/>` : ""}
        </Stream>
    </Connect>
</Response>`;
    }

    const webhookUrl = process.env.VOICE_WEBHOOK_URL || "";
    const gatherUrl = `${webhookUrl}/gather?callSid=${options.callSid}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">${escapeXml(options.greeting)}</Say>
    <Gather input="speech" timeout="5" action="${gatherUrl}" method="POST">
        <Say voice="Polly.Joanna">Please tell me what you need.</Say>
    </Gather>
    <Say voice="Polly.Joanna">I didn't hear anything. Goodbye!</Say>
    <Hangup/>
</Response>`;
}
