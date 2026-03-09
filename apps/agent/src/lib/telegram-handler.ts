/**
 * Shared Telegram Message Handler
 *
 * Reusable functions for processing Telegram webhook updates.
 * Used by both the legacy single-bot webhook and the multi-bot
 * dynamic webhook route.
 */

import { agentResolver, resolveModelOverride } from "@repo/agentc2/agents";
import { managedGenerate, getFastCompressionModel } from "@repo/agentc2";
import { recordActivity, inputPreview } from "@repo/agentc2/activity/service";
import { prisma } from "@repo/database";
import { startRun, extractTokenUsage, extractToolCalls } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { lookupChannelBinding, isUserAllowed, type InstanceContext } from "@/lib/agent-instances";

const FALLBACK_AGENT_SLUG = "bigjim2-appello";
const TELEGRAM_MAX_TEXT_LENGTH = 4000;

const _processedUpdates = new Set<number>();
const MAX_DEDUP_SIZE = 5000;

// ---------------------------------------------------------------------------
// Telegram API helpers
// ---------------------------------------------------------------------------

export async function sendTelegramMessage(
    chatId: string,
    text: string,
    replyToMessageId?: number,
    botToken?: string
): Promise<void> {
    if (!botToken) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

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
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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

export async function sendChatAction(
    chatId: string,
    botToken: string,
    action: string = "typing"
): Promise<void> {
    if (!botToken) return;

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, action })
        });
    } catch {
        // Chat actions are best-effort
    }
}

export async function answerCallbackQuery(
    queryId: string,
    text: string,
    botToken: string
): Promise<void> {
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

export async function listActiveAgents(
    defaultSlug: string,
    organizationId?: string
): Promise<string> {
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

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function getOrCreateSession(
    chatId: string,
    userId: string,
    defaultAgentSlug: string,
    organizationId?: string
) {
    const channelId = `${chatId}:${userId}`;

    let session = await prisma.channelSession.findUnique({
        where: {
            channel_channelId: { channel: "telegram", channelId }
        }
    });

    if (!session) {
        session = await prisma.channelSession.create({
            data: {
                channel: "telegram",
                channelId,
                agentSlug: defaultAgentSlug,
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

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

export function isDuplicate(updateId: number): boolean {
    if (_processedUpdates.has(updateId)) return true;
    _processedUpdates.add(updateId);
    if (_processedUpdates.size > MAX_DEDUP_SIZE) {
        const oldest = _processedUpdates.values().next().value;
        if (oldest !== undefined) _processedUpdates.delete(oldest);
    }
    return false;
}

// ---------------------------------------------------------------------------
// Core message handler
// ---------------------------------------------------------------------------

export interface TelegramHandlerContext {
    botToken: string;
    organizationId?: string;
    /** Fixed agent slug -- skips session/keyword routing when set */
    fixedAgentSlug?: string;
    /** Fixed instance context -- skips channel binding lookup when set */
    fixedInstance?: InstanceContext | null;
}

/**
 * Process a Telegram message update. Returns a result object.
 * This is the shared pipeline used by both legacy and multi-bot webhooks.
 */
export async function handleTelegramMessage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: any,
    ctx: TelegramHandlerContext
): Promise<{ ok: true }> {
    const chatId = message.chat.id.toString();
    const userId = message.from?.id?.toString() || chatId;
    const text = (message.text || "").trim();
    const messageId = message.message_id;

    if (!text) return { ok: true };

    console.log(`[Telegram] Message from user ${userId} in chat ${chatId} (${text.length} chars)`);

    const defaultAgentSlug = ctx.fixedAgentSlug || FALLBACK_AGENT_SLUG;
    const session = await getOrCreateSession(chatId, userId, defaultAgentSlug, ctx.organizationId);

    // Handle help / list commands (skip when agent is fixed to a single bot)
    if (!ctx.fixedAgentSlug && /^\/(help|agents|start)$/i.test(text)) {
        const helpText = await listActiveAgents(defaultAgentSlug, ctx.organizationId);
        await sendTelegramMessage(chatId, helpText, messageId, ctx.botToken);
        return { ok: true };
    }

    // Handle status command
    if (/^\/status$/i.test(text)) {
        await sendTelegramMessage(
            chatId,
            `Current agent: ${session.agentSlug}`,
            messageId,
            ctx.botToken
        );
        return { ok: true };
    }

    // Handle agent switching command (skip when agent is fixed)
    if (!ctx.fixedAgentSlug && text.startsWith("/agent ")) {
        const newAgentSlug = text.slice(7).trim().toLowerCase();
        await prisma.channelSession.update({
            where: { id: session.id },
            data: { agentSlug: newAgentSlug }
        });
        await sendTelegramMessage(
            chatId,
            `Switched to agent: ${newAgentSlug}. How can I help you?`,
            messageId,
            ctx.botToken
        );
        return { ok: true };
    }

    // Look up instance channel binding (unless pre-resolved)
    let instanceBinding: InstanceContext | null =
        ctx.fixedInstance !== undefined ? ctx.fixedInstance : null;
    if (ctx.fixedInstance === undefined) {
        try {
            instanceBinding = await lookupChannelBinding("telegram", chatId);
        } catch (e) {
            console.warn("[Telegram] Failed to look up channel binding:", e);
        }
    }

    // Instance-level access control
    if (instanceBinding && !isUserAllowed(instanceBinding, userId)) {
        await sendTelegramMessage(
            chatId,
            "You don't have access to interact with this agent instance.",
            messageId,
            ctx.botToken
        );
        return { ok: true };
    }

    // Agent slug resolution cascade
    let agentSlug = ctx.fixedAgentSlug || session.agentSlug || defaultAgentSlug;
    let messageText = text;

    // Keyword-based routing (AgentName: message) -- skip when fixed
    if (!ctx.fixedAgentSlug) {
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
    }

    // Instance binding overrides session
    if (instanceBinding) {
        agentSlug = instanceBinding.agentSlug;
    }

    // Build thread/memory IDs
    const telegramThreadId = `telegram-${chatId}`;
    const orgPrefix = ctx.organizationId ? `${ctx.organizationId}:` : "";
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
    await sendChatAction(chatId, ctx.botToken);

    // Model routing (pre-resolve)
    const { modelOverride: routedModelOverride, isReasoningModel } = await resolveModelOverride(
        agentSlug,
        messageText,
        {
            userId,
            organizationId: ctx.organizationId
        }
    );

    // Resolve the agent
    let agent, record, agentId: string;
    try {
        const resolved = await agentResolver.resolve({
            slug: agentSlug,
            requestContext: {
                userId,
                tenantId: ctx.organizationId ?? instanceBinding?.organizationId,
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
                messageId,
                ctx.botToken
            );
            return { ok: true };
        }

        console.log(`[Telegram] Using agent "${agentSlug}" from ${resolved.source}`);
    } catch (error) {
        console.error(`[Telegram] Failed to resolve agent "${agentSlug}":`, error);
        await sendTelegramMessage(
            chatId,
            `I couldn't find an agent called "${agentSlug}". Use /agents to see available agents.`,
            messageId,
            ctx.botToken
        );
        return { ok: true };
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
        const effectiveMaxSteps = instanceBinding?.maxStepsOverride ?? record?.maxSteps ?? 5;
        const memoryOpts = record?.memoryEnabled
            ? { thread: memoryThread, resource: memoryResource }
            : undefined;

        const contextCfg = (record as { contextConfig?: Record<string, unknown> } | null)
            ?.contextConfig;

        const useManagedGenerate = effectiveMaxSteps > 5;

        let responseText: string | undefined;
        let promptTokens = 0;
        let completionTokens = 0;

        if (useManagedGenerate) {
            const compressionModel = await getFastCompressionModel(ctx.organizationId);
            const managedResult = await managedGenerate(agent, messageText, {
                maxSteps: effectiveMaxSteps,
                maxContextTokens: (contextCfg?.maxContextTokens as number) ?? 50_000,
                windowSize: (contextCfg?.windowSize as number) ?? 5,
                anchorInstructions: (contextCfg?.anchorInstructions as boolean) ?? true,
                anchorInterval: (contextCfg?.anchorInterval as number) ?? 10,
                maxTokens: record?.maxTokens ?? undefined,
                memory: memoryOpts,
                modelProvider: record?.modelProvider,
                modelName: record?.modelName,
                compressionModel: compressionModel ?? undefined,
                isReasoningModel: isReasoningModel ?? false,
                onStep: async (_stepNum, summary) => {
                    if (summary.hasToolCall && summary.toolName) {
                        await run.addToolCall({
                            toolKey: summary.toolName,
                            input: {},
                            output: summary.outputPreview,
                            success: true
                        });
                    }
                }
            });

            responseText = managedResult.text;
            promptTokens = managedResult.totalPromptTokens;
            completionTokens = managedResult.totalCompletionTokens;

            if (managedResult.abortReason) {
                console.warn(`[Telegram] managedGenerate aborted: ${managedResult.abortReason}`);
            }
        } else {
            const generateOptions = {
                maxSteps: effectiveMaxSteps,
                ...(memoryOpts ? { memory: memoryOpts } : {})
            } as unknown as Parameters<typeof agent.generate>[1];

            const response = await agent.generate(messageText, generateOptions);
            responseText = response.text;

            const tokens = extractTokenUsage(response);
            const toolCalls = extractToolCalls(response);
            promptTokens = tokens?.promptTokens || 0;
            completionTokens = tokens?.completionTokens || 0;

            for (const tc of toolCalls) {
                await run.addToolCall(tc);
            }
        }

        responseText = responseText || "I'm sorry, I couldn't process that.";

        const costUsd = calculateCost(
            record?.modelName || "unknown",
            record?.modelProvider || "unknown",
            promptTokens,
            completionTokens
        );

        await run.complete({
            output: responseText,
            modelProvider: record?.modelProvider || "unknown",
            modelName: record?.modelName || "unknown",
            promptTokens,
            completionTokens,
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

        const agentName = record?.name || agentSlug;
        const prefixedResponse = `*${agentName}*\n\n${responseText}`;

        await sendTelegramMessage(chatId, prefixedResponse, messageId, ctx.botToken);
        console.log(`[Telegram] Sent response to ${chatId}`);
    } catch (error) {
        await run.fail(error instanceof Error ? error : new Error(String(error)));
        await sendTelegramMessage(
            chatId,
            "I'm sorry, I encountered an error processing your message.",
            messageId,
            ctx.botToken
        );
        throw error;
    }

    return { ok: true };
}

/**
 * Process a callback query update (inline keyboard buttons).
 */
export async function handleCallbackQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: any,
    ctx: TelegramHandlerContext
): Promise<void> {
    const chatId = query.message?.chat?.id?.toString();
    const data = query.data;

    if (chatId && data) {
        if (data.startsWith("agent:")) {
            const newAgentSlug = data.slice(6);
            const userId = query.from?.id?.toString() || chatId;
            const session = await getOrCreateSession(
                chatId,
                userId,
                ctx.fixedAgentSlug || FALLBACK_AGENT_SLUG,
                ctx.organizationId
            );

            await prisma.channelSession.update({
                where: { id: session.id },
                data: { agentSlug: newAgentSlug }
            });

            await answerCallbackQuery(query.id, `Switched to ${newAgentSlug}`, ctx.botToken);
        }
    }
}
