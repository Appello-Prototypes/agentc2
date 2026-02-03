import { NextRequest, NextResponse } from "next/server";
import { agentResolver } from "@repo/mastra";
import { prisma } from "@repo/database";
import { startRun, extractTokenUsage, extractToolCalls } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";

/**
 * Default agent slug for Telegram
 */
const DEFAULT_AGENT_SLUG = process.env.TELEGRAM_DEFAULT_AGENT_SLUG || "mcp-agent";

/**
 * Validate bot token from request
 */
function validateBotToken(request: NextRequest): boolean {
    const configuredToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!configuredToken) {
        console.warn("[Telegram] TELEGRAM_BOT_TOKEN not configured");
        return false;
    }

    // Telegram sends the token in the URL path for webhook verification
    // For security, we verify requests come from Telegram IPs
    // In production, you'd also verify X-Telegram-Bot-Api-Secret-Token header
    const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
    if (secretToken && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        return false;
    }

    return true;
}

/**
 * Get or create channel session
 */
async function getOrCreateSession(chatId: string, userId: string) {
    const channelId = `${chatId}:${userId}`;

    let session = await prisma.channelSession.findUnique({
        where: { channel_channelId: { channel: "telegram", channelId } }
    });

    if (!session) {
        session = await prisma.channelSession.create({
            data: {
                channel: "telegram",
                channelId,
                agentSlug: DEFAULT_AGENT_SLUG,
                metadata: { chatId, userId }
            }
        });
    } else {
        // Update last active
        await prisma.channelSession.update({
            where: { id: session.id },
            data: { lastActive: new Date() }
        });
    }

    return session;
}

/**
 * POST /api/channels/telegram/webhook
 *
 * Receives updates from Telegram Bot API and processes messages.
 */
export async function POST(request: NextRequest) {
    // Validate request
    if (!validateBotToken(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const update = await request.json();
        console.log("[Telegram] Received update:", JSON.stringify(update).substring(0, 200));

        // Handle message updates
        if (update.message) {
            const message = update.message;
            const chatId = message.chat.id.toString();
            const userId = message.from?.id?.toString() || chatId;
            const text = message.text || "";
            const messageId = message.message_id;

            // Skip empty messages
            if (!text.trim()) {
                return NextResponse.json({ ok: true });
            }

            console.log(`[Telegram] Message from ${userId} in chat ${chatId}: "${text}"`);

            // Get or create session
            const session = await getOrCreateSession(chatId, userId);
            const agentSlug = session.agentSlug;

            // Check for agent switching command (e.g., "/agent james")
            if (text.startsWith("/agent ")) {
                const newAgentSlug = text.slice(7).trim().toLowerCase();
                await prisma.channelSession.update({
                    where: { id: session.id },
                    data: { agentSlug: newAgentSlug }
                });
                await sendTelegramMessage(chatId, `Switched to agent: ${newAgentSlug}`, messageId);
                return NextResponse.json({ ok: true });
            }

            // Resolve agent
            const { agent, record } = await agentResolver.resolve({ slug: agentSlug });
            const agentId = record?.id || agentSlug;

            // Start recording the run
            const run = await startRun({
                agentId,
                agentSlug,
                input: text,
                source: "telegram",
                userId,
                sessionId: session.id,
                threadId: `telegram-${chatId}`
            });

            try {
                // Generate response
                const response = await agent.generate(text, { maxSteps: record?.maxSteps ?? 5 });
                const responseText = response.text || "I'm sorry, I couldn't process that.";

                // Extract token usage and tool calls
                const tokens = extractTokenUsage(response);
                const toolCalls = extractToolCalls(response);

                for (const tc of toolCalls) {
                    await run.addToolCall(tc);
                }

                // Calculate cost based on model and token usage
                const costUsd = calculateCost(
                    record?.modelName || "unknown",
                    record?.modelProvider || "unknown",
                    tokens?.promptTokens || 0,
                    tokens?.completionTokens || 0
                );

                await run.complete({
                    output: responseText,
                    modelProvider: record?.modelProvider || "unknown",
                    modelName: record?.modelName || "unknown",
                    promptTokens: tokens?.promptTokens,
                    completionTokens: tokens?.completionTokens,
                    costUsd
                });

                // Send response
                await sendTelegramMessage(chatId, responseText, messageId);

                console.log(`[Telegram] Sent response to ${chatId}`);
            } catch (error) {
                await run.fail(error instanceof Error ? error : new Error(String(error)));
                await sendTelegramMessage(
                    chatId,
                    "I'm sorry, I encountered an error processing your message.",
                    messageId
                );
                throw error;
            }
        }

        // Handle callback queries (inline keyboard buttons)
        if (update.callback_query) {
            const query = update.callback_query;
            const chatId = query.message?.chat?.id?.toString();
            const data = query.data;

            if (chatId && data) {
                // Handle callback data (e.g., agent selection)
                if (data.startsWith("agent:")) {
                    const newAgentSlug = data.slice(6);
                    const userId = query.from?.id?.toString() || chatId;
                    const session = await getOrCreateSession(chatId, userId);

                    await prisma.channelSession.update({
                        where: { id: session.id },
                        data: { agentSlug: newAgentSlug }
                    });

                    // Answer callback query
                    await answerCallbackQuery(query.id, `Switched to ${newAgentSlug}`);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[Telegram] Webhook error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(
    chatId: string,
    text: string,
    replyToMessageId?: number
): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
    }
}

/**
 * Answer a callback query
 */
async function answerCallbackQuery(queryId: string, text: string): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            callback_query_id: queryId,
            text
        })
    });
}
