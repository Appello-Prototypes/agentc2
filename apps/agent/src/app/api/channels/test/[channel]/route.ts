import { NextRequest, NextResponse } from "next/server";
import type { CheckResult } from "@/lib/channel-diagnostics";
import {
    checkTwilioCredentials,
    checkTwilioPhoneNumber,
    checkElevenLabsCredentials,
    checkElevenLabsAgent,
    checkElevenLabsSignedUrl,
    checkNgrokTunnel,
    checkTelegramBot,
    checkTelegramWebhook,
    checkWhatsAppSession
} from "@/lib/channel-diagnostics";
import { resolveChannelCredentials, type CredentialSource } from "@/lib/channel-credentials";
import { authenticateRequest } from "@/lib/api-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestRequest {
    dryRun?: boolean;
    testPhoneNumber?: string;
    testText?: string;
    testChatId?: string;
    testNumber?: string;
}

interface TestResponse {
    channel: string;
    dryRun: boolean;
    timestamp: string;
    credentialSource: CredentialSource;
    checks: CheckResult[];
    summary: { total: number; passed: number; failed: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runCheck(
    name: string,
    fn: () => Promise<{ status: "pass" | "fail"; message: string; details?: unknown }>
): Promise<CheckResult> {
    const start = Date.now();
    try {
        const result = await fn();
        return { name, ...result, durationMs: Date.now() - start };
    } catch (error) {
        return {
            name,
            status: "fail",
            message: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start
        };
    }
}

function buildResponse(
    channel: string,
    dryRun: boolean,
    source: CredentialSource,
    checks: CheckResult[]
): TestResponse {
    return {
        channel,
        dryRun,
        timestamp: new Date().toISOString(),
        credentialSource: source,
        checks,
        summary: {
            total: checks.length,
            passed: checks.filter((c) => c.status === "pass").length,
            failed: checks.filter((c) => c.status === "fail").length
        }
    };
}

// ---------------------------------------------------------------------------
// Twilio E2E Tests
// ---------------------------------------------------------------------------

async function testTwilio(body: TestRequest, organizationId?: string): Promise<TestResponse> {
    const dryRun = body.dryRun !== false;
    const { credentials: creds, source } = await resolveChannelCredentials(
        "twilio-voice",
        organizationId
    );
    const checks: CheckResult[] = [];

    // 1. Credential checks
    checks.push(await checkTwilioCredentials(creds));
    checks.push(await checkTwilioPhoneNumber(creds));

    // 2. TwiML generation (dry run - always safe)
    checks.push(
        await runCheck("TwiML generation", async () => {
            const greeting = "This is a test call from the diagnostics suite.";
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">${greeting}</Say>
    <Hangup/>
</Response>`;
            return { status: "pass", message: "TwiML generated successfully", details: { twiml } };
        })
    );

    // 3. Webhook URL reachability
    const webhookUrl = creds.VOICE_WEBHOOK_URL || process.env.VOICE_WEBHOOK_URL;
    if (webhookUrl) {
        checks.push(
            await runCheck("Webhook URL reachable", async () => {
                try {
                    const res = await fetch(webhookUrl, {
                        method: "HEAD",
                        signal: AbortSignal.timeout(5000)
                    });
                    return {
                        status: res.ok || res.status === 405 ? "pass" : "fail",
                        message: `Webhook URL responded with HTTP ${res.status}`,
                        details: { url: webhookUrl, status: res.status }
                    };
                } catch {
                    return { status: "fail", message: `Webhook URL unreachable: ${webhookUrl}` };
                }
            })
        );
    }

    // 4. Test call (only if not dry run and phone number provided)
    if (!dryRun && body.testPhoneNumber) {
        checks.push(
            await runCheck("Test call", async () => {
                const sid = creds.TWILIO_ACCOUNT_SID;
                const token = creds.TWILIO_AUTH_TOKEN;
                const fromNumber = creds.TWILIO_PHONE_NUMBER;
                if (!sid || !token || !fromNumber) {
                    return { status: "fail", message: "Missing Twilio credentials" };
                }

                const auth = Buffer.from(`${sid}:${token}`).toString("base64");
                const params = new URLSearchParams({
                    To: body.testPhoneNumber!,
                    From: fromNumber,
                    Twiml: `<Response><Say voice="Polly.Joanna">This is a test call from your Mastra diagnostics suite. Everything is working correctly. Goodbye!</Say><Hangup/></Response>`
                });

                const res = await fetch(
                    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Basic ${auth}`,
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: params.toString()
                    }
                );

                if (!res.ok) {
                    const errBody = await res.text();
                    return {
                        status: "fail",
                        message: `Failed to place test call: HTTP ${res.status}`,
                        details: errBody
                    };
                }

                const data = await res.json();
                return {
                    status: "pass",
                    message: `Test call initiated (SID: ${data.sid})`,
                    details: { callSid: data.sid, status: data.status }
                };
            })
        );
    } else if (!dryRun && !body.testPhoneNumber) {
        checks.push({
            name: "Test call",
            status: "fail",
            message: "testPhoneNumber is required when dryRun is false",
            durationMs: 0
        });
    }

    return buildResponse("twilio", dryRun, source, checks);
}

// ---------------------------------------------------------------------------
// ElevenLabs E2E Tests
// ---------------------------------------------------------------------------

async function testElevenLabs(body: TestRequest, organizationId?: string): Promise<TestResponse> {
    const dryRun = body.dryRun !== false;
    const { credentials: creds, source } = await resolveChannelCredentials(
        "elevenlabs",
        organizationId
    );
    const checks: CheckResult[] = [];

    // 1. Credential + agent checks
    checks.push(await checkElevenLabsCredentials(creds));
    checks.push(await checkElevenLabsAgent(creds));
    checks.push(await checkElevenLabsSignedUrl(creds));
    checks.push(await checkNgrokTunnel());

    // 2. List available conversational agents
    checks.push(
        await runCheck("List conversational agents", async () => {
            const apiKey = creds.ELEVENLABS_API_KEY;
            if (!apiKey) return { status: "fail", message: "Missing API key" };

            const res = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
                headers: { "xi-api-key": apiKey }
            });
            if (!res.ok) {
                return { status: "fail", message: `Failed to list agents (HTTP ${res.status})` };
            }
            const data = await res.json();
            const agents = data.agents || [];
            return {
                status: "pass",
                message: `${agents.length} conversational agent(s) found`,
                details: agents.map((a: { agent_id: string; name: string }) => ({
                    id: a.agent_id,
                    name: a.name
                }))
            };
        })
    );

    // 3. TTS generation test (only if not dry run)
    if (!dryRun) {
        const testText =
            body.testText || "Hello, this is a test from the Mastra diagnostics suite.";
        checks.push(
            await runCheck("TTS audio generation", async () => {
                const apiKey = creds.ELEVENLABS_API_KEY;
                if (!apiKey) return { status: "fail", message: "Missing API key" };

                const res = await fetch(
                    "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
                    {
                        method: "POST",
                        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
                        body: JSON.stringify({ text: testText, model_id: "eleven_monolingual_v1" })
                    }
                );
                if (!res.ok) {
                    return { status: "fail", message: `TTS failed (HTTP ${res.status})` };
                }
                const audioBuffer = await res.arrayBuffer();
                return {
                    status: "pass",
                    message: `TTS generated ${audioBuffer.byteLength} bytes of audio`,
                    details: {
                        text: testText,
                        audioSizeBytes: audioBuffer.byteLength,
                        contentType: res.headers.get("content-type")
                    }
                };
            })
        );
    }

    // 4. Webhook endpoint responds
    const webhookUrl = creds.ELEVENLABS_MCP_WEBHOOK_URL || process.env.ELEVENLABS_MCP_WEBHOOK_URL;
    if (webhookUrl) {
        checks.push(
            await runCheck("Webhook endpoint reachable", async () => {
                try {
                    const res = await fetch(webhookUrl, {
                        method: "GET",
                        signal: AbortSignal.timeout(5000)
                    });
                    return {
                        status: res.ok ? "pass" : "fail",
                        message: `Webhook endpoint responded with HTTP ${res.status}`,
                        details: { url: webhookUrl, status: res.status }
                    };
                } catch {
                    return { status: "fail", message: `Webhook unreachable: ${webhookUrl}` };
                }
            })
        );
    }

    return buildResponse("elevenlabs", dryRun, source, checks);
}

// ---------------------------------------------------------------------------
// Telegram E2E Tests
// ---------------------------------------------------------------------------

async function testTelegram(body: TestRequest, organizationId?: string): Promise<TestResponse> {
    const dryRun = body.dryRun !== false;
    const { credentials: creds, source } = await resolveChannelCredentials(
        "telegram-bot",
        organizationId
    );
    const checks: CheckResult[] = [];

    // 1. Bot validation + webhook status
    checks.push(await checkTelegramBot(creds));
    checks.push(await checkTelegramWebhook(creds));

    // 2. Get bot commands
    checks.push(
        await runCheck("Bot commands", async () => {
            const token = creds.TELEGRAM_BOT_TOKEN;
            if (!token) return { status: "fail", message: "Missing bot token" };

            const res = await fetch(`https://api.telegram.org/bot${token}/getMyCommands`);
            if (!res.ok) {
                return { status: "fail", message: `Failed to get commands (HTTP ${res.status})` };
            }
            const data = await res.json();
            const commands = data.result || [];
            return {
                status: "pass",
                message: `${commands.length} bot command(s) configured`,
                details: commands
            };
        })
    );

    // 3. Send test message (only if not dry run and chat ID provided)
    if (!dryRun && body.testChatId) {
        checks.push(
            await runCheck("Send test message", async () => {
                const token = creds.TELEGRAM_BOT_TOKEN;
                if (!token) return { status: "fail", message: "Missing bot token" };

                const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: body.testChatId,
                        text: "Test message from Mastra diagnostics suite. If you see this, Telegram integration is working correctly."
                    })
                });

                if (!res.ok) {
                    const errBody = await res.json();
                    return {
                        status: "fail",
                        message: `Failed to send message: ${errBody.description || res.status}`,
                        details: errBody
                    };
                }

                const data = await res.json();
                return {
                    status: "pass",
                    message: `Test message sent (message_id: ${data.result.message_id})`,
                    details: { messageId: data.result.message_id, chatId: body.testChatId }
                };
            })
        );
    } else if (!dryRun && !body.testChatId) {
        checks.push({
            name: "Send test message",
            status: "fail",
            message: "testChatId is required when dryRun is false",
            durationMs: 0
        });
    }

    return buildResponse("telegram", dryRun, source, checks);
}

// ---------------------------------------------------------------------------
// WhatsApp E2E Tests
// ---------------------------------------------------------------------------

async function testWhatsApp(body: TestRequest, _organizationId?: string): Promise<TestResponse> {
    const dryRun = body.dryRun !== false;
    const { source } = await resolveChannelCredentials("whatsapp-web", _organizationId);
    const checks: CheckResult[] = [];

    // 1. Session check
    checks.push(await checkWhatsAppSession());

    // 2. Send test message (only if not dry run, connected, and number provided)
    if (!dryRun && body.testNumber) {
        checks.push(
            await runCheck("Send test message", async () => {
                try {
                    const { isWhatsAppInitialized, getWhatsAppService } =
                        await import("@/app/api/channels/whatsapp/_service");
                    if (!isWhatsAppInitialized()) {
                        return { status: "fail", message: "WhatsApp not initialized" };
                    }
                    const service = await getWhatsAppService();
                    if (service.getStatus() !== "connected") {
                        return {
                            status: "fail",
                            message: `WhatsApp not connected (status: ${service.getStatus()})`
                        };
                    }
                    const result = await service.send({
                        channel: "whatsapp",
                        to: body.testNumber!,
                        text: "Test message from Mastra diagnostics suite. If you see this, WhatsApp integration is working correctly."
                    });
                    if (result.success) {
                        return {
                            status: "pass",
                            message: `Test message sent (ID: ${result.messageId})`,
                            details: result
                        };
                    }
                    return {
                        status: "fail",
                        message: result.error || "Failed to send",
                        details: result
                    };
                } catch (error) {
                    return {
                        status: "fail",
                        message: error instanceof Error ? error.message : "Send failed"
                    };
                }
            })
        );
    } else if (!dryRun && !body.testNumber) {
        checks.push({
            name: "Send test message",
            status: "fail",
            message: "testNumber is required when dryRun is false",
            durationMs: 0
        });
    }

    return buildResponse("whatsapp", dryRun, source, checks);
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

type TestRunner = (body: TestRequest, organizationId?: string) => Promise<TestResponse>;

const CHANNEL_RUNNERS: Record<string, TestRunner> = {
    twilio: testTwilio,
    elevenlabs: testElevenLabs,
    telegram: testTelegram,
    whatsapp: testWhatsApp
};

/**
 * POST /api/channels/test/[channel]
 *
 * Run E2E tests for a specific channel.
 * Defaults to dryRun=true (validates without sending real messages/calls).
 * Authenticated: resolves credentials from the user's org first.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ channel: string }> }
) {
    try {
        const { channel } = await params;
        const runner = CHANNEL_RUNNERS[channel];

        if (!runner) {
            return NextResponse.json(
                {
                    error: `Unknown channel: ${channel}`,
                    validChannels: Object.keys(CHANNEL_RUNNERS)
                },
                { status: 400 }
            );
        }

        // Try to authenticate for org context
        let organizationId: string | undefined;
        try {
            const authContext = await authenticateRequest(request);
            organizationId = authContext?.organizationId;
        } catch {
            // Continue without org context
        }

        let body: TestRequest = {};
        try {
            body = await request.json();
        } catch {
            // No body or invalid JSON - use defaults
        }

        const results = await runner(body, organizationId);
        return NextResponse.json(results);
    } catch (error) {
        console.error("[Channel Test] Error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}
