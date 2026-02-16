import { NextRequest, NextResponse } from "next/server";
import type { ChannelType, SendResult } from "@repo/mastra/channels";
import { agentResolver } from "@repo/mastra/agents";
import { prisma } from "@repo/database";

/**
 * POST /api/channels/outbound
 *
 * Unified outbound messaging API for all channels.
 * Allows agents to proactively contact users via WhatsApp, Telegram, or Voice.
 *
 * Body:
 * - channel: "whatsapp" | "telegram" | "voice" - Target channel
 * - to: string - Recipient (phone number or chat ID)
 * - message?: string - Message text (optional if using agent)
 * - agentSlug?: string - Agent to generate the message (if message not provided)
 * - prompt?: string - Prompt for agent to generate message (if using agent)
 * - voiceGreeting?: string - Custom greeting for voice calls
 * - maxDuration?: number - Max duration for voice calls (seconds)
 * - voiceMode?: "gather" | "stream" - Voice mode (default: "gather")
 * - elevenlabsAgentId?: string - ElevenLabs agent ID for stream mode
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            channel,
            to,
            message,
            agentSlug,
            prompt,
            voiceGreeting,
            maxDuration,
            voiceMode,
            elevenlabsAgentId
        } = body;

        // Validate required fields
        if (!channel || !to) {
            return NextResponse.json(
                { error: "Missing required fields: channel, to" },
                { status: 400 }
            );
        }

        // Validate channel type
        if (!["whatsapp", "telegram", "voice"].includes(channel)) {
            return NextResponse.json(
                { error: "Invalid channel. Use: whatsapp, telegram, voice" },
                { status: 400 }
            );
        }

        // Generate message using agent if needed
        let messageText = message;
        if (!messageText && agentSlug && prompt) {
            const { agent } = await agentResolver.resolve({ slug: agentSlug });
            const response = await agent.generate(prompt, { maxSteps: 3 });
            messageText = response.text || "Hello! I wanted to reach out to you.";
        }

        if (!messageText && channel !== "voice") {
            return NextResponse.json(
                { error: "Missing message. Provide 'message' or 'agentSlug' + 'prompt'" },
                { status: 400 }
            );
        }

        // Send via appropriate channel
        let result: SendResult;

        switch (channel as ChannelType) {
            case "whatsapp":
                result = await sendWhatsApp(to, messageText!);
                break;
            case "telegram":
                result = await sendTelegram(to, messageText!);
                break;
            case "voice":
                result = await initiateVoiceCall(
                    to,
                    voiceGreeting || messageText,
                    maxDuration,
                    voiceMode,
                    elevenlabsAgentId
                );
                break;
            default:
                return NextResponse.json({ error: "Channel not implemented" }, { status: 501 });
        }

        // Log the outbound message
        if (result.success) {
            await logOutboundMessage({
                channel,
                to,
                message: messageText || voiceGreeting || "",
                agentSlug,
                messageId: result.messageId
            });
        }

        return NextResponse.json({
            success: result.success,
            channel,
            to,
            messageId: result.messageId,
            error: result.error,
            timestamp: result.timestamp || new Date()
        });
    } catch (error) {
        console.error("[Outbound] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/channels/outbound
 *
 * Get outbound message history.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const channel = searchParams.get("channel");
        const limit = parseInt(searchParams.get("limit") || "20", 10);

        const sessions = await prisma.channelSession.findMany({
            where: channel ? { channel } : undefined,
            orderBy: { lastActive: "desc" },
            take: limit
        });

        return NextResponse.json({
            sessions,
            total: sessions.length
        });
    } catch (error) {
        console.error("[Outbound] History error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * Send message via WhatsApp
 */
async function sendWhatsApp(to: string, text: string): Promise<SendResult> {
    const enabled = process.env.WHATSAPP_ENABLED === "true";
    if (!enabled) {
        return { success: false, error: "WhatsApp channel disabled" };
    }

    try {
        const { getWhatsAppService } = await import("../whatsapp/_service");
        const service = await getWhatsAppService();

        if (service.getStatus() !== "connected") {
            return { success: false, error: "WhatsApp not connected" };
        }

        return service.send({ channel: "whatsapp", to, text });
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "WhatsApp send failed"
        };
    }
}

/**
 * Send message via Telegram
 */
async function sendTelegram(chatId: string, text: string): Promise<SendResult> {
    const enabled = process.env.TELEGRAM_ENABLED === "true";
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!enabled || !botToken) {
        return { success: false, error: "Telegram channel disabled or not configured" };
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text })
        });

        const result = await response.json();

        if (!response.ok) {
            return { success: false, error: result.description || "Telegram API error" };
        }

        return {
            success: true,
            messageId: result.result?.message_id?.toString(),
            timestamp: new Date()
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Telegram send failed"
        };
    }
}

/**
 * Initiate a voice call via Twilio
 */
async function initiateVoiceCall(
    to: string,
    greeting?: string,
    maxDuration?: number,
    mode?: "gather" | "stream",
    elevenlabsAgentId?: string
): Promise<SendResult> {
    const enabled = process.env.TWILIO_ENABLED === "true";
    if (!enabled) {
        return { success: false, error: "Voice channel disabled" };
    }

    try {
        const { getVoiceService } = await import("../voice/_service");
        const service = await getVoiceService();

        if (service.getStatus() !== "connected") {
            return { success: false, error: "Voice service not connected" };
        }

        const call = await service.initiateCall({
            to,
            greeting,
            maxDuration,
            mode: mode === "stream" ? "stream" : "gather",
            elevenlabsAgentId
        });

        return {
            success: true,
            messageId: call.callId,
            timestamp: call.startedAt
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Voice call failed"
        };
    }
}

/**
 * Log outbound message for history
 */
async function logOutboundMessage(data: {
    channel: string;
    to: string;
    message: string;
    agentSlug?: string;
    messageId?: string;
}): Promise<void> {
    try {
        // Update or create session
        const channelId = data.to;

        await prisma.channelSession.upsert({
            where: {
                channel_channelId: { channel: data.channel, channelId }
            },
            update: {
                lastActive: new Date(),
                metadata: {
                    lastOutboundMessage: data.message.substring(0, 500),
                    lastOutboundAt: new Date().toISOString(),
                    lastMessageId: data.messageId
                }
            },
            create: {
                channel: data.channel,
                channelId,
                agentSlug: data.agentSlug || "mcp-agent",
                metadata: {
                    lastOutboundMessage: data.message.substring(0, 500),
                    lastOutboundAt: new Date().toISOString(),
                    lastMessageId: data.messageId
                }
            }
        });
    } catch (error) {
        console.error("[Outbound] Failed to log message:", error);
    }
}
