import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { agentResolver } from "@repo/mastra";

/**
 * Default agent to use for Slack conversations
 * Can be overridden via SLACK_DEFAULT_AGENT_SLUG env var
 */
const DEFAULT_AGENT_SLUG = process.env.SLACK_DEFAULT_AGENT_SLUG || "assistant";

/**
 * Slack Event Types
 */
interface SlackEventBase {
    type: string;
    channel?: string;
    user?: string;
    ts?: string;
    thread_ts?: string;
    text?: string;
}

interface SlackAppMentionEvent extends SlackEventBase {
    type: "app_mention";
    channel: string;
    user: string;
    ts: string;
    text: string;
}

interface SlackMessageEvent extends SlackEventBase {
    type: "message";
    channel: string;
    user: string;
    ts: string;
    text: string;
    channel_type?: "im" | "channel" | "group";
    subtype?: string;
}

interface SlackUrlVerificationPayload {
    type: "url_verification";
    challenge: string;
    token: string;
}

interface SlackEventCallbackPayload {
    type: "event_callback";
    token: string;
    team_id: string;
    event: SlackAppMentionEvent | SlackMessageEvent;
    event_id: string;
    event_time: number;
}

type SlackPayload = SlackUrlVerificationPayload | SlackEventCallbackPayload;

/**
 * Verify Slack request signature
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
function verifySlackSignature(
    signingSecret: string,
    signature: string | null,
    timestamp: string | null,
    body: string
): boolean {
    if (!signature || !timestamp) {
        console.warn("[Slack] Missing signature or timestamp headers");
        return false;
    }

    // Check timestamp is not too old (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 60 * 5) {
        console.warn("[Slack] Request timestamp is too old");
        return false;
    }

    // Create signature base string
    const sigBaseString = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac("sha256", signingSecret);
    hmac.update(sigBaseString);
    const mySignature = `v0=${hmac.digest("hex")}`;

    // Compare signatures using timing-safe comparison
    try {
        return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
    } catch {
        return false;
    }
}

/**
 * Strip bot mention from message text
 * Slack sends text like "<@U123456> hello" - we extract just "hello"
 */
function stripBotMention(text: string): string {
    // Remove <@USER_ID> patterns at the start of the message
    return text.replace(/^<@[A-Z0-9]+>\s*/i, "").trim();
}

/**
 * Send a message to Slack using the Web API
 * Requires SLACK_BOT_TOKEN environment variable
 */
async function sendSlackMessage(
    channelId: string,
    text: string,
    threadTs?: string
): Promise<boolean> {
    const botToken = process.env.SLACK_BOT_TOKEN;

    if (!botToken) {
        console.error("[Slack] SLACK_BOT_TOKEN not configured");
        return false;
    }

    try {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${botToken}`
            },
            body: JSON.stringify({
                channel: channelId,
                text,
                ...(threadTs && { thread_ts: threadTs })
            })
        });

        const result = await response.json();

        if (!result.ok) {
            console.error("[Slack] API error:", result.error);
            return false;
        }

        console.log("[Slack] Message sent successfully to", channelId);
        return true;
    } catch (error) {
        console.error("[Slack] Failed to send message:", error);
        return false;
    }
}

/**
 * Process a Slack message and generate a response
 */
async function processMessage(
    text: string,
    userId: string,
    channelId: string,
    threadTs: string
): Promise<string> {
    const startTime = Date.now();

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Slack] Processing message at ${new Date().toISOString()}`);
    console.log(`[Slack] User: ${userId}`);
    console.log(`[Slack] Channel: ${channelId}`);
    console.log(`[Slack] Thread: ${threadTs}`);
    console.log(`[Slack] Message: ${text}`);

    try {
        // Resolve the agent
        const { agent, source } = await agentResolver.resolve({
            slug: DEFAULT_AGENT_SLUG,
            requestContext: {
                userId,
                metadata: {
                    platform: "slack",
                    channelId,
                    threadTs
                }
            }
        });

        console.log(`[Slack] Using agent "${DEFAULT_AGENT_SLUG}" from ${source}`);

        // Generate response with memory thread based on Slack thread
        const memoryThreadId = `slack-${channelId}-${threadTs}`;

        const response = await agent.generate(text, {
            maxSteps: 5
        });

        const duration = Date.now() - startTime;
        console.log(`[Slack] Response generated in ${duration}ms`);
        console.log(`[Slack] Response preview: ${response.text?.substring(0, 200)}...`);
        console.log(`${"=".repeat(60)}\n`);

        return response.text || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
        console.error("[Slack] Error processing message:", error);
        return "I encountered an error processing your message. Please try again.";
    }
}

/**
 * POST /api/slack/events
 *
 * Receives events from Slack:
 * - URL verification challenge (for initial setup)
 * - app_mention events (when bot is @mentioned)
 * - message events (for DMs)
 *
 * Requires:
 * - SLACK_SIGNING_SECRET: For request verification
 * - SLACK_BOT_TOKEN: For sending responses (via Slack MCP)
 */
export async function POST(request: NextRequest) {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    // Get the raw body for signature verification
    const body = await request.text();

    // In development, skip signature verification if no secret configured
    if (signingSecret) {
        const signature = request.headers.get("x-slack-signature");
        const timestamp = request.headers.get("x-slack-request-timestamp");

        if (!verifySlackSignature(signingSecret, signature, timestamp, body)) {
            console.warn("[Slack] Invalid signature - request rejected");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
    } else {
        console.warn("[Slack] SLACK_SIGNING_SECRET not configured - skipping verification");
    }

    // Parse the JSON payload
    let payload: SlackPayload;
    try {
        payload = JSON.parse(body);
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log(`[Slack] Received event type: ${payload.type}`);

    // Handle URL verification challenge (required for Slack app setup)
    if (payload.type === "url_verification") {
        console.log("[Slack] Responding to URL verification challenge");
        return NextResponse.json({ challenge: payload.challenge });
    }

    // Handle event callbacks
    if (payload.type === "event_callback") {
        const event = payload.event;

        // Ignore bot messages to prevent loops
        if ("subtype" in event && event.subtype === "bot_message") {
            console.log("[Slack] Ignoring bot message");
            return NextResponse.json({ ok: true });
        }

        // Handle app_mention events (when someone @mentions the bot)
        if (event.type === "app_mention") {
            const mentionEvent = event as SlackAppMentionEvent;
            const cleanText = stripBotMention(mentionEvent.text);

            if (!cleanText) {
                console.log("[Slack] Empty message after stripping mention, ignoring");
                return NextResponse.json({ ok: true });
            }

            // Process asynchronously to respond within 3 seconds
            // Slack requires acknowledgment within 3 seconds
            setImmediate(async () => {
                const threadTs = mentionEvent.thread_ts || mentionEvent.ts;
                const response = await processMessage(
                    cleanText,
                    mentionEvent.user,
                    mentionEvent.channel,
                    threadTs
                );

                // Reply in the thread
                await sendSlackMessage(mentionEvent.channel, response, threadTs);
            });

            // Acknowledge immediately
            return NextResponse.json({ ok: true });
        }

        // Handle direct message events
        if (event.type === "message" && "channel_type" in event && event.channel_type === "im") {
            const messageEvent = event as SlackMessageEvent;

            // Skip messages from bots or with subtypes (edits, deletes, etc.)
            if (messageEvent.subtype) {
                console.log(`[Slack] Ignoring message with subtype: ${messageEvent.subtype}`);
                return NextResponse.json({ ok: true });
            }

            // Process asynchronously
            setImmediate(async () => {
                const threadTs = messageEvent.thread_ts || messageEvent.ts;
                const response = await processMessage(
                    messageEvent.text,
                    messageEvent.user,
                    messageEvent.channel,
                    threadTs
                );

                // Reply in the thread for DMs too
                await sendSlackMessage(messageEvent.channel, response, threadTs);
            });

            // Acknowledge immediately
            return NextResponse.json({ ok: true });
        }

        console.log(`[Slack] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ ok: true });
}

/**
 * GET /api/slack/events
 *
 * Health check endpoint and setup instructions
 */
export async function GET() {
    const hasSigningSecret = !!process.env.SLACK_SIGNING_SECRET;
    const hasBotToken = !!process.env.SLACK_BOT_TOKEN;
    const defaultAgent = DEFAULT_AGENT_SLUG;

    return NextResponse.json({
        status: "Slack integration active",
        configuration: {
            signingSecretConfigured: hasSigningSecret,
            botTokenConfigured: hasBotToken,
            defaultAgent
        },
        setup: {
            step1: "Create a Slack App at https://api.slack.com/apps",
            step2: "Enable Event Subscriptions and set Request URL to this endpoint",
            step3: "Subscribe to bot events: app_mention, message.im",
            step4: "Install app to workspace and copy Bot Token",
            step5: "Add SLACK_SIGNING_SECRET and SLACK_BOT_TOKEN to .env",
            requiredScopes: [
                "app_mentions:read",
                "chat:write",
                "im:history",
                "im:read",
                "im:write",
                "channels:history",
                "channels:read"
            ]
        }
    });
}
