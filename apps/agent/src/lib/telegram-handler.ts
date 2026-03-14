/**
 * Shared Telegram Message Handler
 *
 * Reusable functions for processing Telegram webhook updates.
 * Used by both the legacy single-bot webhook and the multi-bot
 * dynamic webhook route.
 */

import { agentResolver, resolveModelOverride } from "@repo/agentc2/agents";
import { formatForTelegram } from "@repo/agentc2/channels";
// managedGenerate removed — context management handled by Mastra processors
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
    botToken?: string,
    parseMode?: "HTML" | "Markdown" | "MarkdownV2"
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
        const body: Record<string, unknown> = {
            chat_id: chatId,
            text: chunks[i]
        };
        if (parseMode) body.parse_mode = parseMode;
        if (i === 0 && replyToMessageId) body.reply_parameters = { message_id: replyToMessageId };

        let response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok && parseMode) {
            console.warn(
                `[Telegram] parse_mode=${parseMode} rejected, retrying without formatting`
            );
            const plainBody = { ...body };
            delete plainBody.parse_mode;
            response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(plainBody)
            });
        }

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
            type: "USER",
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
        const defaultWs = organizationId
            ? await prisma.workspace.findFirst({
                  where: { organizationId, isDefault: true },
                  select: { id: true }
              })
            : null;
        session = await prisma.channelSession.create({
            data: {
                channel: "telegram",
                channelId,
                agentSlug: defaultAgentSlug,
                organizationId: organizationId ?? "",
                workspaceId: defaultWs?.id ?? "",
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

    // Handle SDLC ticket submission: /sdlc <title>\n<description> or sdlc: <title>
    const sdlcMatch = text.match(/^(?:\/sdlc\s+|sdlc:\s*)([\s\S]+)/i);
    if (sdlcMatch) {
        await sendChatAction(chatId, ctx.botToken);
        const sdlcText = sdlcMatch[1].trim();
        const lines = sdlcText.split("\n").filter((l: string) => l.trim());
        const title = lines[0] || sdlcText.slice(0, 200);
        const description = lines.length > 1 ? lines.slice(1).join("\n") : title;

        try {
            const agentBaseUrl = process.env.NEXT_PUBLIC_APP_URL
                ? `${process.env.NEXT_PUBLIC_APP_URL}/agent`
                : "http://localhost:3001";

            const org = ctx.organizationId
                ? await prisma.organization.findUnique({
                      where: { id: ctx.organizationId },
                      select: { slug: true }
                  })
                : null;

            const res = await fetch(`${agentBaseUrl}/api/sdlc/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": process.env.MCP_API_KEY || "",
                    "X-Organization-Slug": org?.slug || ""
                },
                body: JSON.stringify({
                    title,
                    description,
                    channel: "telegram",
                    channelUserId: userId
                })
            });

            const data = await res.json();
            if (data.success) {
                await sendTelegramMessage(
                    chatId,
                    `📋 *SDLC Ticket #${data.ticketNumber} created*\n\n` +
                        `*Title:* ${title}\n` +
                        `*Pipeline:* \`${data.workflowSlug}\`\n\n` +
                        `The ticket has been dispatched to the SDLC coding pipeline. ` +
                        `You'll be notified when a review is needed.`,
                    messageId,
                    ctx.botToken
                );
            } else {
                await sendTelegramMessage(
                    chatId,
                    `❌ Failed to create SDLC ticket: ${data.error || "Unknown error"}`,
                    messageId,
                    ctx.botToken
                );
            }
        } catch (err) {
            console.error("[Telegram] SDLC submission error:", err);
            await sendTelegramMessage(
                chatId,
                "❌ Failed to submit SDLC ticket. Please try again.",
                messageId,
                ctx.botToken
            );
        }
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
                    where: {
                        slug: possibleAgent,
                        isActive: true,
                        ...(ctx.organizationId
                            ? { workspace: { organizationId: ctx.organizationId } }
                            : {})
                    },
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
    const { modelOverride: routedModelOverride } = await resolveModelOverride(
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
                organizationId: ctx.organizationId ?? instanceBinding?.organizationId,
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

        // Context management (windowing, anchoring, tool guards, result compression)
        // is handled by Mastra processors wired into the agent by the resolver.

        let responseText: string | undefined;
        let promptTokens = 0;
        let completionTokens = 0;

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
        const formattedBody = formatForTelegram(responseText);
        const prefixedResponse = `<b>${agentName}</b>\n\n${formattedBody}`;

        await sendTelegramMessage(chatId, prefixedResponse, messageId, ctx.botToken, "HTML");
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
 * Handles agent switching and engagement approval/reject/feedback actions.
 */
export async function handleCallbackQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: any,
    ctx: TelegramHandlerContext
): Promise<void> {
    const chatId = query.message?.chat?.id?.toString();
    const data = query.data as string | undefined;

    if (!chatId || !data) return;

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
        return;
    }

    // Engagement approval actions: engagement_approve:ID, engagement_reject:ID, engagement_feedback:ID
    const engagementMatch = data.match(/^engagement_(approve|reject|feedback):(.+)$/);
    if (engagementMatch) {
        const [, action, approvalId] = engagementMatch;
        const decidedBy =
            query.from?.username ||
            query.from?.first_name ||
            query.from?.id?.toString() ||
            "telegram-user";

        try {
            const { findEngagementById, resolveEngagement } =
                await import("@repo/agentc2/workflows");

            const engagementId = await findEngagementById(approvalId);
            if (!engagementId) {
                await answerCallbackQuery(
                    query.id,
                    "This review has already been resolved.",
                    ctx.botToken
                );
                return;
            }

            if (action === "feedback") {
                await answerCallbackQuery(
                    query.id,
                    "Reply to this message with your feedback.",
                    ctx.botToken
                );
                // Store the approval ID in metadata so we can match the reply
                await prisma.channelSession.upsert({
                    where: {
                        channel_channelId: {
                            channel: "telegram",
                            channelId: `feedback:${chatId}`
                        }
                    },
                    update: {
                        agentSlug: approvalId,
                        lastActive: new Date()
                    },
                    create: {
                        channel: "telegram",
                        channelId: `feedback:${chatId}`,
                        agentSlug: approvalId,
                        organizationId: ctx.organizationId || "",
                        workspaceId: "",
                        metadata: { type: "pending-feedback" }
                    }
                });
                return;
            }

            const decision = action === "approve" ? "approved" : "rejected";
            const result = await resolveEngagement({
                approvalRequestId: engagementId,
                decision: decision as "approved" | "rejected",
                decidedBy,
                channel: "telegram"
            });

            if (result.resumed) {
                const emoji = decision === "approved" ? "✅" : "❌";
                const label = decision === "approved" ? "Approved" : "Rejected";
                await answerCallbackQuery(query.id, `${emoji} ${label}`, ctx.botToken);

                // Update the original message to reflect the decision
                try {
                    const messageId = query.message?.message_id;
                    if (messageId) {
                        const originalText = query.message?.text || "";
                        await fetch(`https://api.telegram.org/bot${ctx.botToken}/editMessageText`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: `${originalText}\n\n${emoji} *${label}* by ${decidedBy}`,
                                parse_mode: "Markdown"
                            })
                        });
                    }
                } catch {
                    // Best-effort message update
                }
            } else {
                await answerCallbackQuery(
                    query.id,
                    result.error || "Failed to resolve review.",
                    ctx.botToken
                );
            }
        } catch (err) {
            console.error("[Telegram] Engagement callback error:", err);
            await answerCallbackQuery(query.id, "Error processing review action.", ctx.botToken);
        }
    }
}

/**
 * Handle a reply that may be feedback for a pending engagement.
 * Called from the webhook route when a message is a reply to a bot message.
 */
export async function handleEngagementFeedbackReply(
    chatId: string,
    text: string,
    userId: string,
    ctx: TelegramHandlerContext
): Promise<boolean> {
    const feedbackSession = await prisma.channelSession.findUnique({
        where: {
            channel_channelId: {
                channel: "telegram",
                channelId: `feedback:${chatId}`
            }
        }
    });

    if (!feedbackSession || !feedbackSession.agentSlug) return false;

    const approvalId = feedbackSession.agentSlug;

    // Clean up the feedback session
    await prisma.channelSession.delete({
        where: { id: feedbackSession.id }
    });

    try {
        const { findEngagementById, resolveEngagement } = await import("@repo/agentc2/workflows");

        const engagementId = await findEngagementById(approvalId);
        if (!engagementId) {
            await sendTelegramMessage(
                chatId,
                "This review has already been resolved.",
                undefined,
                ctx.botToken
            );
            return true;
        }

        const decidedBy = userId;
        const result = await resolveEngagement({
            approvalRequestId: engagementId,
            decision: "feedback",
            message: text,
            decidedBy,
            channel: "telegram"
        });

        if (result.resumed) {
            await sendTelegramMessage(
                chatId,
                "💬 Feedback submitted. Workflow will re-analyze with your comments.",
                undefined,
                ctx.botToken
            );
        } else {
            await sendTelegramMessage(
                chatId,
                `Failed to submit feedback: ${result.error || "Unknown error"}`,
                undefined,
                ctx.botToken
            );
        }

        return true;
    } catch (err) {
        console.error("[Telegram] Engagement feedback reply error:", err);
        return false;
    }
}
