import { NextRequest, NextResponse } from "next/server";
import { agentResolver, resolveModelOverride } from "@repo/agentc2/agents";
import { recordActivity, inputPreview } from "@repo/agentc2/activity/service";
import { prisma } from "@repo/database";
import { startRun, extractTokenUsage, extractToolCalls } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";
import { resolveChannelCredentials } from "@/lib/channel-credentials";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { lookupChannelBinding, isUserAllowed, type InstanceContext } from "@/lib/agent-instances";

const FALLBACK_AGENT_SLUG = "bigjim2-appello";

/** Telegram message text limit */
const TELEGRAM_MAX_TEXT_LENGTH = 4000;

/** Cached credentials with timestamp-based TTL */
let _cachedCreds: Record<string, string> | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 60_000;

/** Simple update_id-based dedup to avoid processing retried webhooks */
const _processedUpdates = new Set<number>();
const MAX_DEDUP_SIZE = 5000;

async function getTelegramCredentials(): Promise<Record<string, string>> {
    const now = Date.now();
    if (!_cachedCreds || now - _cachedAt > CACHE_TTL_MS) {
        const { credentials } = await resolveChannelCredentials("telegram-bot");
        _cachedCreds = credentials;
        _cachedAt = now;
    }
    return _cachedCreds;
}

function getTelegramBotToken(creds: Record<string, string>): string | undefined {
    return creds.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
}

function getDefaultAgentSlug(creds: Record<string, string>): string {
    return (
        creds.TELEGRAM_DEFAULT_AGENT_SLUG ||
        process.env.TELEGRAM_DEFAULT_AGENT_SLUG ||
        FALLBACK_AGENT_SLUG
    );
}

function validateBotToken(request: NextRequest, creds: Record<string, string>): boolean {
    const configuredToken = getTelegramBotToken(creds);
    if (!configuredToken) {
        console.warn("[Telegram] TELEGRAM_BOT_TOKEN not configured");
        return false;
    }

    const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
    const expectedSecret = creds.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;

    if (process.env.NODE_ENV === "production" && expectedSecret) {
        if (!secretToken || secretToken !== expectedSecret) {
            return false;
        }
    } else if (secretToken && expectedSecret && secretToken !== expectedSecret) {
        return false;
    }

    return true;
}

/**
 * Get or create channel session for a Telegram chat.
 */
async function getOrCreateSession(chatId: string, userId: string, organizationId?: string) {
    const channelId = `${chatId}:${userId}`;

    let session = await prisma.channelSession.findUnique({
        where: { channel_channelId: { channel: "telegram", channelId } }
    });

    if (!session) {
        const creds = await getTelegramCredentials();
        session = await prisma.channelSession.create({
            data: {
                channel: "telegram",
                channelId,
                agentSlug: getDefaultAgentSlug(creds),
                organizationId,
                metadata: { chatId, userId }
            }
        });
    } else {
        await prisma.channelSession.update({
            where: { id: session.id },
            data: { lastActive: new Date() }
        });
    }

    return session;
}

/**
 * Resolve org ID from Telegram IntegrationConnection.
 */
async function resolveOrganizationId(): Promise<string | undefined> {
    const connection = await prisma.integrationConnection.findFirst({
        where: { provider: { key: "telegram-bot" }, isActive: true },
        select: { organizationId: true }
    });
    return connection?.organizationId ?? undefined;
}

/**
 * List active agents for Telegram (plain text, no markdown to avoid parse issues).
 */
async function listActiveAgents(defaultSlug: string, organizationId?: string): Promise<string> {
    const agents = await prisma.agent.findMany({
        where: {
            isActive: true,
            type: { in: ["SYSTEM", "USER"] },
            ...(organizationId ? { workspace: { organizationId } } : {})
        },
        select: { slug: true, name: true, description: true },
        orderBy: { name: "asc" }
    });

    if (agents.length === 0) {
        return "No active agents found.";
    }

    const lines = agents.map((a) => {
        const desc = a.description ? ` — ${a.description}` : "";
        return `• /agent ${a.slug}  —  ${a.name}${desc}`;
    });

    return [
        "📋 Available Agents",
        "",
        ...lines,
        "",
        `Default: ${defaultSlug}`,
        "",
        "Commands:",
        "• /agent <slug> — Switch to an agent",
        "• /agents — List available agents",
        "• /help — Show this help",
        "• /status — Show current agent"
    ].join("\n");
}

/**
 * Send a message via Telegram Bot API with long-message splitting.
 */
async function sendTelegramMessage(
    chatId: string,
    text: string,
    replyToMessageId?: number,
    botToken?: string
): Promise<void> {
    const creds = await getTelegramCredentials();
    const token = botToken || getTelegramBotToken(creds);
    if (!token) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    // Split long messages at paragraph boundaries
    const chunks: string[] = [];
    if (text.length <= TELEGRAM_MAX_TEXT_LENGTH) {
        chunks.push(text);
    } else {
        let remaining = text;
        while (remaining.length > TELEGRAM_MAX_TEXT_LENGTH) {
            let splitIdx = remaining.lastIndexOf("\n\n", TELEGRAM_MAX_TEXT_LENGTH);
            if (splitIdx < TELEGRAM_MAX_TEXT_LENGTH * 0.3) {
                splitIdx = remaining.lastIndexOf("\n", TELEGRAM_MAX_TEXT_LENGTH);
            }
            if (splitIdx < TELEGRAM_MAX_TEXT_LENGTH * 0.3) {
                splitIdx = TELEGRAM_MAX_TEXT_LENGTH;
            }
            chunks.push(remaining.slice(0, splitIdx).trimEnd());
            remaining = remaining.slice(splitIdx).trimStart();
        }
        if (remaining) chunks.push(remaining);
    }

    for (let i = 0; i < chunks.length; i++) {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: chunks[i],
                reply_parameters:
                    i === 0 && replyToMessageId ? { message_id: replyToMessageId } : undefined
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
        }
    }
}

/**
 * Send a "typing" chat action.
 */
async function sendChatAction(chatId: string, action: string = "typing"): Promise<void> {
    const creds = await getTelegramCredentials();
    const token = getTelegramBotToken(creds);
    if (!token) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, action })
        });
    } catch {
        // Chat actions are best-effort
    }
}

/**
 * Answer a callback query.
 */
async function answerCallbackQuery(queryId: string, text: string): Promise<void> {
    const creds = await getTelegramCredentials();
    const botToken = getTelegramBotToken(creds);
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

/**
 * POST /api/channels/telegram/webhook
 *
 * Receives updates from Telegram Bot API and processes messages.
 * Full feature parity with Slack:
 * - Conversation memory (Mastra)
 * - Instance channel bindings for routing
 * - Agent routing cascade
 * - Help/list/status commands
 * - Per-agent identity
 * - Activity recording
 * - Long message splitting
 * - Update deduplication
 */
export async function POST(request: NextRequest) {
    const creds = await getTelegramCredentials();
    if (!validateBotToken(request, creds)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const update = await request.json();
        console.log("[Telegram] Received update:", JSON.stringify(update).substring(0, 200));

        // Dedup: skip already-processed update IDs (Telegram may retry)
        if (update.update_id) {
            if (_processedUpdates.has(update.update_id)) {
                console.log(`[Telegram] Duplicate update_id ${update.update_id}, ignoring`);
                return NextResponse.json({ ok: true });
            }
            _processedUpdates.add(update.update_id);
            if (_processedUpdates.size > MAX_DEDUP_SIZE) {
                const oldest = _processedUpdates.values().next().value;
                if (oldest !== undefined) _processedUpdates.delete(oldest);
            }
        }

        // Handle message updates
        if (update.message) {
            const message = update.message;
            const chatId = message.chat.id.toString();
            const userId = message.from?.id?.toString() || chatId;
            const text = (message.text || "").trim();
            const messageId = message.message_id;

            if (!text) {
                return NextResponse.json({ ok: true });
            }

            console.log(
                `[Telegram] Message from user ${userId} in chat ${chatId} (${text.length} chars)`
            );

            const channelOrgId = await resolveOrganizationId();
            const session = await getOrCreateSession(chatId, userId, channelOrgId);

            // Handle help / list commands
            if (/^\/(help|agents|start)$/i.test(text)) {
                const helpText = await listActiveAgents(getDefaultAgentSlug(creds), channelOrgId);
                await sendTelegramMessage(chatId, helpText, messageId);
                return NextResponse.json({ ok: true });
            }

            // Handle status command
            if (/^\/status$/i.test(text)) {
                await sendTelegramMessage(chatId, `Current agent: ${session.agentSlug}`, messageId);
                return NextResponse.json({ ok: true });
            }

            // Handle agent switching command
            if (text.startsWith("/agent ")) {
                const newAgentSlug = text.slice(7).trim().toLowerCase();
                await prisma.channelSession.update({
                    where: { id: session.id },
                    data: { agentSlug: newAgentSlug }
                });
                await sendTelegramMessage(
                    chatId,
                    `Switched to agent: ${newAgentSlug}. How can I help you?`,
                    messageId
                );
                return NextResponse.json({ ok: true });
            }

            // Look up instance channel binding
            let instanceBinding: InstanceContext | null = null;
            try {
                instanceBinding = await lookupChannelBinding("telegram", chatId);
            } catch (e) {
                console.warn("[Telegram] Failed to look up channel binding:", e);
            }

            // Instance-level access control
            if (instanceBinding && !isUserAllowed(instanceBinding, userId)) {
                await sendTelegramMessage(
                    chatId,
                    "You don't have access to interact with this agent instance.",
                    messageId
                );
                return NextResponse.json({ ok: true });
            }

            // Agent slug resolution cascade
            let agentSlug = session.agentSlug || getDefaultAgentSlug(creds);
            let messageText = text;

            // Keyword-based routing (AgentName: message)
            const keywordMatch = text.match(/^([a-z0-9_-]+):\s*([\s\S]+)/i);
            if (keywordMatch) {
                const possibleAgent = keywordMatch[1].toLowerCase();
                const possibleMessage = keywordMatch[2].trim();
                try {
                    const agentExists = await prisma.agent.findFirst({
                        where: { slug: possibleAgent, isActive: true },
                        select: { id: true }
                    });
                    if (agentExists) {
                        agentSlug = possibleAgent;
                        messageText = possibleMessage;
                    }
                } catch {
                    // Not a valid agent slug, treat as normal message
                }
            }

            // Instance binding overrides session
            if (instanceBinding) {
                agentSlug = instanceBinding.agentSlug;
            }

            // Build thread/memory IDs
            const telegramThreadId = `telegram-${chatId}`;
            const orgPrefix = channelOrgId ? `${channelOrgId}:` : "";
            const memoryThread = instanceBinding
                ? `${orgPrefix}${instanceBinding.memoryNamespace}-${chatId}`
                : `${orgPrefix}${telegramThreadId}`;
            const memoryResource = instanceBinding
                ? `${orgPrefix}${instanceBinding.memoryNamespace}`
                : `${orgPrefix}${userId}`;

            // Build request context metadata
            const requestMetadata: Record<string, unknown> = {
                platform: "telegram",
                chatId,
                chatType: message.chat.type
            };
            if (instanceBinding) {
                requestMetadata._instanceContext = {
                    instanceId: instanceBinding.instanceId,
                    instanceName: instanceBinding.instanceName,
                    instanceSlug: instanceBinding.instanceSlug,
                    contextType: instanceBinding.contextType,
                    contextId: instanceBinding.contextId,
                    contextData: instanceBinding.contextData,
                    instructionOverrides: instanceBinding.instructionOverrides,
                    memoryNamespace: instanceBinding.memoryNamespace
                };
            }

            // Show "typing" indicator
            await sendChatAction(chatId);

            // Model routing (pre-resolve)
            const { modelOverride: routedModelOverride } = await resolveModelOverride(
                agentSlug,
                messageText,
                { userId, organizationId: channelOrgId }
            );

            // Resolve the agent
            let agent, record, agentId: string;
            try {
                const resolved = await agentResolver.resolve({
                    slug: agentSlug,
                    requestContext: {
                        userId,
                        tenantId: channelOrgId ?? instanceBinding?.organizationId,
                        metadata: requestMetadata
                    },
                    threadId: memoryThread,
                    modelOverride: routedModelOverride
                });
                agent = resolved.agent;
                record = resolved.record;
                agentId = record?.id || agentSlug;

                if (record?.type === "DEMO") {
                    await sendTelegramMessage(
                        chatId,
                        `"${agentSlug}" is a demo agent and isn't available on Telegram. Use /agents to see available agents.`,
                        messageId
                    );
                    return NextResponse.json({ ok: true });
                }

                console.log(`[Telegram] Using agent "${agentSlug}" from ${resolved.source}`);
            } catch (error) {
                console.error(`[Telegram] Failed to resolve agent "${agentSlug}":`, error);
                await sendTelegramMessage(
                    chatId,
                    `I couldn't find an agent called "${agentSlug}". Use /agents to see available agents.`,
                    messageId
                );
                return NextResponse.json({ ok: true });
            }

            // Start recording the run
            const run = await startRun({
                agentId,
                agentSlug,
                input: messageText,
                source: "telegram",
                userId,
                sessionId: session.id,
                threadId: memoryThread,
                instanceId: instanceBinding?.instanceId ?? undefined,
                ...(instanceBinding
                    ? {
                          metadata: {
                              instanceId: instanceBinding.instanceId,
                              instanceSlug: instanceBinding.instanceSlug
                          }
                      }
                    : {})
            });

            // Record trigger event
            try {
                await createTriggerEventRecord({
                    agentId,
                    runId: run.runId,
                    sourceType: "telegram",
                    entityType: "agent",
                    payload: { input: messageText },
                    metadata: { userId, chatId, source: "telegram" }
                });
            } catch (e) {
                console.warn("[Telegram] Failed to record trigger event:", e);
            }

            try {
                const effectiveMaxSteps =
                    instanceBinding?.maxStepsOverride ?? record?.maxSteps ?? 5;
                const generateOptions = {
                    maxSteps: effectiveMaxSteps,
                    ...(record?.memoryEnabled
                        ? {
                              memory: {
                                  thread: memoryThread,
                                  resource: memoryResource
                              }
                          }
                        : {})
                } as unknown as Parameters<typeof agent.generate>[1];

                const response = await agent.generate(messageText, generateOptions);
                const responseText = response.text || "I'm sorry, I couldn't process that.";

                const tokens = extractTokenUsage(response);
                const toolCalls = extractToolCalls(response);

                for (const tc of toolCalls) {
                    await run.addToolCall(tc);
                }

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

                recordActivity({
                    type: "TELEGRAM_MESSAGE_HANDLED",
                    agentId,
                    agentSlug,
                    agentName: record?.name,
                    summary: `Handled Telegram message from ${userId}: ${inputPreview(messageText)}`,
                    status: "success",
                    source: "telegram",
                    runId: run.runId,
                    metadata: { chatId, chatType: message.chat.type }
                });

                // Per-agent identity: prefix with agent name
                const agentName = record?.name || agentSlug;
                const prefixedResponse = `*${agentName}*\n\n${responseText}`;

                await sendTelegramMessage(chatId, prefixedResponse, messageId);
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
                if (data.startsWith("agent:")) {
                    const newAgentSlug = data.slice(6);
                    const userId = query.from?.id?.toString() || chatId;
                    const channelOrgId = await resolveOrganizationId();
                    const session = await getOrCreateSession(chatId, userId, channelOrgId);

                    await prisma.channelSession.update({
                        where: { id: session.id },
                        data: { agentSlug: newAgentSlug }
                    });

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
