import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { agentResolver } from "@repo/mastra";
import { prisma, type Prisma } from "@repo/database";
import { startRun, extractTokenUsage, extractToolCalls } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";
import { resolveIdentity } from "@/lib/identity";
import { handleSlackApprovalReaction } from "@/lib/approvals";

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
    subtype?: string;
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
    message?: {
        text?: string;
        ts?: string;
    };
    edited?: { user?: string; ts?: string };
    deleted_ts?: string;
    files?: unknown[];
}

interface SlackReactionEvent extends SlackEventBase {
    type: "reaction_added";
    user: string;
    reaction: string;
    item: {
        type?: string;
        channel: string;
        ts: string;
    };
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
    event: SlackAppMentionEvent | SlackMessageEvent | SlackReactionEvent;
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
 * Parse an optional agent directive from the message text.
 * Supports:
 *   "agent:research What is X?" -> { slug: "research", text: "What is X?" }
 *   "What is X?"                -> { slug: DEFAULT_AGENT_SLUG, text: "What is X?" }
 *   "agent:list"                -> { slug: null, text: "", isListCommand: true }
 *   "help"                      -> { slug: null, text: "", isListCommand: true }
 */
function parseAgentDirective(text: string): {
    slug: string | null;
    text: string;
    isListCommand: boolean;
} {
    const trimmed = text.trim();

    // Check for help / list commands
    if (/^(help|agent:list)$/i.test(trimmed)) {
        return { slug: null, text: "", isListCommand: true };
    }

    // Check for agent:slug prefix
    const match = trimmed.match(/^agent:([a-z0-9_-]+)\s*(.*)/i);
    if (match) {
        return { slug: match[1], text: match[2].trim(), isListCommand: false };
    }

    // No directive -- use default agent
    return { slug: DEFAULT_AGENT_SLUG, text: trimmed, isListCommand: false };
}

/**
 * List active agents from the database and format as a Slack message.
 */
async function listActiveAgents(): Promise<string> {
    const agents = await prisma.agent.findMany({
        where: { isActive: true },
        select: { slug: true, name: true, description: true },
        orderBy: { name: "asc" }
    });

    if (agents.length === 0) {
        return "No active agents found.";
    }

    const lines = agents.map((a) => {
        const desc = a.description ? ` -- ${a.description}` : "";
        return `  \`agent:${a.slug}\`  *${a.name}*${desc}`;
    });

    return [
        "*Available Agents*",
        "",
        ...lines,
        "",
        `_Default agent: \`${DEFAULT_AGENT_SLUG}\`_`,
        '_Usage: prefix your message with `agent:<slug>` to talk to a specific agent._'
    ].join("\n");
}

/**
 * Resolve Slack display identity from the agent record's metadata.
 * Falls back to the agent name when no slack-specific config is set.
 */
function resolveSlackIdentity(record: {
    name: string;
    metadata: unknown;
}): { username?: string; icon_emoji?: string; icon_url?: string } {
    const metadata = record.metadata as Record<string, unknown> | null;
    const slack = metadata?.slack as Record<string, unknown> | undefined;

    const username = (slack?.displayName as string) || record.name;
    const iconEmoji = slack?.iconEmoji as string | undefined;
    const iconUrl = slack?.iconUrl as string | undefined;

    return {
        username,
        ...(iconEmoji ? { icon_emoji: iconEmoji } : {}),
        ...(iconUrl ? { icon_url: iconUrl } : {})
    };
}

/**
 * Send a message to Slack using the Web API.
 * Supports per-message display identity (username, icon_emoji, icon_url)
 * via the chat:write.customize scope.
 */
async function sendSlackMessage(
    channelId: string,
    text: string,
    threadTs?: string,
    identity?: { username?: string; icon_emoji?: string; icon_url?: string }
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
                ...(threadTs && { thread_ts: threadTs }),
                ...(identity?.username && { username: identity.username }),
                ...(identity?.icon_emoji && { icon_emoji: identity.icon_emoji }),
                ...(identity?.icon_url && { icon_url: identity.icon_url })
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

const resolveSlackWorkspaceContext = async () => {
    const agentRecord = await prisma.agent.findFirst({
        where: { slug: DEFAULT_AGENT_SLUG },
        select: { id: true, workspaceId: true }
    });

    if (!agentRecord?.workspaceId) {
        return {
            agentId: agentRecord?.id || null,
            workspaceId: null,
            organizationId: null
        };
    }

    const workspace = await prisma.workspace.findUnique({
        where: { id: agentRecord.workspaceId },
        select: { organizationId: true }
    });

    return {
        agentId: agentRecord.id,
        workspaceId: agentRecord.workspaceId,
        organizationId: workspace?.organizationId || null
    };
};

const resolveSlackConnection = async (organizationId: string | null) => {
    if (!organizationId) return null;
    const provider = await prisma.integrationProvider.findUnique({
        where: { key: "slack" }
    });
    if (!provider) return null;
    return prisma.integrationConnection.findFirst({
        where: {
            organizationId,
            providerId: provider.id,
            isActive: true
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });
};

const upsertChatMessage = async (options: {
    organizationId: string;
    workspaceId: string | null;
    integrationConnectionId: string | null;
    channelId: string;
    messageTs: string;
    userId: string | null;
    text: string | null;
    isEdited?: boolean;
    isDeleted?: boolean;
    reactions?: unknown[];
    attachments?: unknown[];
    metadata?: Record<string, unknown>;
}) => {
    const integrationConnectionId = options.integrationConnectionId;
    if (!integrationConnectionId) {
        return null;
    }
    return prisma.chatMessage.upsert({
        where: {
            integrationConnectionId_messageTs: {
                integrationConnectionId,
                messageTs: options.messageTs
            }
        },
        create: {
            organizationId: options.organizationId,
            workspaceId: options.workspaceId,
            integrationConnectionId,
            channelId: options.channelId,
            messageTs: options.messageTs,
            userId: options.userId,
            text: options.text,
            isEdited: options.isEdited ?? false,
            isDeleted: options.isDeleted ?? false,
            reactionsJson: options.reactions
                ? (options.reactions as Prisma.InputJsonValue)
                : undefined,
            attachmentsJson: options.attachments
                ? (options.attachments as Prisma.InputJsonValue)
                : undefined,
            metadata: options.metadata
                ? (JSON.parse(JSON.stringify(options.metadata)) as Prisma.InputJsonValue)
                : undefined
        },
        update: {
            text: options.text,
            isEdited: options.isEdited ?? false,
            isDeleted: options.isDeleted ?? false,
            reactionsJson: options.reactions
                ? (options.reactions as Prisma.InputJsonValue)
                : undefined,
            attachmentsJson: options.attachments
                ? (options.attachments as Prisma.InputJsonValue)
                : undefined,
            metadata: options.metadata
                ? (JSON.parse(JSON.stringify(options.metadata)) as Prisma.InputJsonValue)
                : undefined
        }
    });
};

const appendChatReaction = async (options: {
    organizationId: string;
    workspaceId: string | null;
    integrationConnectionId: string | null;
    channelId: string;
    messageTs: string;
    reaction: string;
    userId: string;
}) => {
    const integrationConnectionId = options.integrationConnectionId;
    if (!integrationConnectionId) {
        return null;
    }
    const existing = await prisma.chatMessage.findUnique({
        where: {
            integrationConnectionId_messageTs: {
                integrationConnectionId,
                messageTs: options.messageTs
            }
        }
    });

    const reactions = Array.isArray(existing?.reactionsJson)
        ? [...(existing?.reactionsJson as unknown[])]
        : [];
    const attachments = Array.isArray(existing?.attachmentsJson)
        ? (existing?.attachmentsJson as unknown[])
        : undefined;

    reactions.push({
        reaction: options.reaction,
        userId: options.userId,
        addedAt: new Date().toISOString()
    });

    return upsertChatMessage({
        organizationId: options.organizationId,
        workspaceId: options.workspaceId,
        integrationConnectionId: options.integrationConnectionId,
        channelId: options.channelId,
        messageTs: options.messageTs,
        userId: existing?.userId || options.userId,
        text: existing?.text || null,
        isEdited: existing?.isEdited || false,
        isDeleted: existing?.isDeleted || false,
        reactions,
        attachments
    });
};

/**
 * Result returned from processMessage, including the response text
 * and the agent record for display identity.
 */
interface ProcessMessageResult {
    text: string;
    identity: { username?: string; icon_emoji?: string; icon_url?: string };
}

/**
 * Process a Slack message and generate a response.
 * Records the run in AgentRun for full observability.
 * Supports per-message agent routing and conversation memory.
 */
async function processMessage(
    text: string,
    userId: string,
    channelId: string,
    threadTs: string,
    messageTs: string,
    agentSlug?: string
): Promise<ProcessMessageResult> {
    const slug = agentSlug || DEFAULT_AGENT_SLUG;
    const slackThreadId = `slack-${channelId}-${threadTs}`;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Slack] Processing message at ${new Date().toISOString()}`);
    console.log(`[Slack] User: ${userId}`);
    console.log(`[Slack] Channel: ${channelId}`);
    console.log(`[Slack] Thread: ${threadTs}`);
    console.log(`[Slack] Agent: ${slug}`);
    console.log(`[Slack] Message: ${text}`);

    // Resolve the agent
    let agentId: string;
    let agent;
    let record;
    let source: string;

    try {
        const resolved = await agentResolver.resolve({
            slug,
            requestContext: {
                userId,
                metadata: {
                    platform: "slack",
                    channelId,
                    threadTs
                }
            }
        });

        agent = resolved.agent;
        record = resolved.record;
        source = resolved.source;
        agentId = record?.id || slug;

        console.log(`[Slack] Using agent "${slug}" from ${source}`);
    } catch (error) {
        console.error(`[Slack] Failed to resolve agent "${slug}":`, error);
        return {
            text: `I couldn't find an agent called \`${slug}\`. Use \`help\` to see available agents.`,
            identity: {}
        };
    }

    // Resolve display identity from agent metadata
    const identity = record
        ? resolveSlackIdentity({ name: record.name, metadata: record.metadata })
        : {};

    const workspaceId = record?.workspaceId || null;
    const organizationId = workspaceId
        ? (
              await prisma.workspace.findUnique({
                  where: { id: workspaceId },
                  select: { organizationId: true }
              })
          )?.organizationId || null
        : null;
    const connection = await resolveSlackConnection(organizationId);

    if (organizationId) {
        await resolveIdentity({
            organizationId,
            slackUserId: userId
        });
    }

    if (organizationId && messageTs) {
        await upsertChatMessage({
            organizationId,
            workspaceId,
            integrationConnectionId: connection?.id || null,
            channelId,
            messageTs,
            userId,
            text,
            metadata: {
                threadTs,
                agentSlug: slug
            }
        });
    }

    // Start recording the run
    const run = await startRun({
        agentId,
        agentSlug: slug,
        input: text,
        source: "slack",
        userId,
        threadId: slackThreadId,
        sessionId: channelId
    });

    try {
        // Build generate options with memory persistence when enabled
        const generateOptions = {
            maxSteps: record?.maxSteps ?? 5,
            ...(record?.memoryEnabled
                ? {
                      memory: {
                          thread: slackThreadId,
                          resource: userId
                      }
                  }
                : {})
        } as unknown as Parameters<typeof agent.generate>[1];

        const response = await agent.generate(text, generateOptions);

        // Extract token usage
        const tokens = extractTokenUsage(response);

        // Record tool calls
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

        // Complete the run
        await run.complete({
            output: response.text || "",
            modelProvider: record?.modelProvider || "unknown",
            modelName: record?.modelName || "unknown",
            promptTokens: tokens?.promptTokens,
            completionTokens: tokens?.completionTokens,
            costUsd
        });

        console.log(`[Slack] Response preview: ${response.text?.substring(0, 200)}...`);
        console.log(`${"=".repeat(60)}\n`);

        return {
            text: response.text || "I'm sorry, I couldn't generate a response.",
            identity
        };
    } catch (error) {
        // Record the failure
        await run.fail(error instanceof Error ? error : new Error(String(error)));

        console.error("[Slack] Error processing message:", error);
        return {
            text: "I encountered an error processing your message. Please try again.",
            identity
        };
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

            // Parse agent directive (e.g. "agent:research What is X?" or "help")
            const directive = parseAgentDirective(cleanText);

            // Process asynchronously to respond within 3 seconds
            // Slack requires acknowledgment within 3 seconds
            setImmediate(async () => {
                const threadTs = mentionEvent.thread_ts || mentionEvent.ts;

                // Handle help / agent:list command
                if (directive.isListCommand) {
                    const helpText = await listActiveAgents();
                    await sendSlackMessage(mentionEvent.channel, helpText, threadTs);
                    return;
                }

                const result = await processMessage(
                    directive.text,
                    mentionEvent.user,
                    mentionEvent.channel,
                    threadTs,
                    mentionEvent.ts,
                    directive.slug || undefined
                );

                // Reply in the thread with per-agent display identity
                await sendSlackMessage(
                    mentionEvent.channel,
                    result.text,
                    threadTs,
                    result.identity
                );
            });

            // Acknowledge immediately
            return NextResponse.json({ ok: true });
        }

        if (event.type === "reaction_added") {
            const reactionEvent = event as SlackReactionEvent;

            setImmediate(async () => {
                const context = await resolveSlackWorkspaceContext();
                const connection = await resolveSlackConnection(context.organizationId);

                if (context.organizationId) {
                    await resolveIdentity({
                        organizationId: context.organizationId,
                        slackUserId: reactionEvent.user
                    });

                    await appendChatReaction({
                        organizationId: context.organizationId,
                        workspaceId: context.workspaceId,
                        integrationConnectionId: connection?.id || null,
                        channelId: reactionEvent.item.channel,
                        messageTs: reactionEvent.item.ts,
                        reaction: reactionEvent.reaction,
                        userId: reactionEvent.user
                    });
                }

                await handleSlackApprovalReaction({
                    channelId: reactionEvent.item.channel,
                    messageTs: reactionEvent.item.ts,
                    reaction: reactionEvent.reaction,
                    slackUserId: reactionEvent.user
                });
            });

            return NextResponse.json({ ok: true });
        }

        // Handle direct message events
        if (event.type === "message") {
            const messageEvent = event as SlackMessageEvent;

            if (messageEvent.subtype === "message_changed") {
                setImmediate(async () => {
                    const context = await resolveSlackWorkspaceContext();
                    const connection = await resolveSlackConnection(context.organizationId);
                    const changedMessage = messageEvent.message;
                    const messageTs = changedMessage?.ts || messageEvent.ts;

                    if (context.organizationId && messageTs) {
                        await upsertChatMessage({
                            organizationId: context.organizationId,
                            workspaceId: context.workspaceId,
                            integrationConnectionId: connection?.id || null,
                            channelId: messageEvent.channel,
                            messageTs,
                            userId: messageEvent.user,
                            text: changedMessage?.text || messageEvent.text || null,
                            isEdited: true,
                            metadata: {
                                edited: messageEvent.edited || null
                            }
                        });
                    }
                });

                return NextResponse.json({ ok: true });
            }

            if (messageEvent.subtype === "message_deleted") {
                setImmediate(async () => {
                    const context = await resolveSlackWorkspaceContext();
                    const connection = await resolveSlackConnection(context.organizationId);
                    const messageTs = messageEvent.deleted_ts || messageEvent.ts;

                    if (context.organizationId && messageTs) {
                        await upsertChatMessage({
                            organizationId: context.organizationId,
                            workspaceId: context.workspaceId,
                            integrationConnectionId: connection?.id || null,
                            channelId: messageEvent.channel,
                            messageTs,
                            userId: messageEvent.user,
                            text: null,
                            isDeleted: true
                        });
                    }
                });

                return NextResponse.json({ ok: true });
            }

            if (messageEvent.subtype) {
                console.log(`[Slack] Ignoring message with subtype: ${messageEvent.subtype}`);
                return NextResponse.json({ ok: true });
            }

            if ("channel_type" in event && event.channel_type === "im") {
                // Parse agent directive from DM text
                const directive = parseAgentDirective(messageEvent.text);

                // Process asynchronously
                setImmediate(async () => {
                    const threadTs = messageEvent.thread_ts || messageEvent.ts;

                    // Handle help / agent:list command
                    if (directive.isListCommand) {
                        const helpText = await listActiveAgents();
                        await sendSlackMessage(messageEvent.channel, helpText, threadTs);
                        return;
                    }

                    const result = await processMessage(
                        directive.text,
                        messageEvent.user,
                        messageEvent.channel,
                        threadTs,
                        messageEvent.ts,
                        directive.slug || undefined
                    );

                    // Reply in the thread with per-agent display identity
                    await sendSlackMessage(
                        messageEvent.channel,
                        result.text,
                        threadTs,
                        result.identity
                    );
                });

                // Acknowledge immediately
                return NextResponse.json({ ok: true });
            }
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
                "chat:write.customize",
                "im:history",
                "im:read",
                "im:write",
                "channels:history",
                "channels:read"
            ]
        }
    });
}
