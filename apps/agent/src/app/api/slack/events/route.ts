import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { agentResolver } from "@repo/mastra";
import { prisma, type Prisma } from "@repo/database";
import { startRun, extractTokenUsage, extractToolCalls } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";
import { resolveIdentity } from "@/lib/identity";
import { handleSlackApprovalReaction } from "@/lib/approvals";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import {
    resolveSlackInstallation,
    isDuplicateSlackEvent,
    getBotUserIdForInstallation,
    type SlackInstallationContext
} from "@/lib/slack-tokens";

/**
 * Hardcoded last-resort fallback when neither the database nor the env var
 * specifies a default Slack agent.
 */
const FALLBACK_AGENT_SLUG = "assistant";

/**
 * Check if the bot has previously participated in a thread.
 * Uses database as primary source (AgentRun records).
 * Thread ID format: "slack-{teamId}-{channelId}-{threadTs}" (multi-tenant safe).
 * Falls back to legacy "slack-{channelId}-{threadTs}" for existing Appello threads.
 */
async function isThreadActive(
    teamId: string,
    channelId: string,
    threadTs: string
): Promise<boolean> {
    try {
        // Check new format first
        const newFormatId = `slack-${teamId}-${channelId}-${threadTs}`;
        const priorRun = await prisma.agentRun.findFirst({
            where: { threadId: newFormatId, source: "slack" },
            select: { id: true }
        });
        if (priorRun) return true;

        // Fallback: check legacy format for backward compatibility
        const legacyFormatId = `slack-${channelId}-${threadTs}`;
        const legacyRun = await prisma.agentRun.findFirst({
            where: { threadId: legacyFormatId, source: "slack" },
            select: { id: true }
        });
        if (legacyRun) return true;
    } catch {
        // DB failure -- don't auto-reply
    }
    return false;
}

/**
 * Build the thread ID for a Slack message. Includes teamId for multi-tenant isolation.
 */
function buildSlackThreadId(teamId: string, channelId: string, threadTs: string): string {
    return `slack-${teamId}-${channelId}-${threadTs}`;
}

/**
 * Check rate limits for a Slack user within an org's Slack connection.
 * Returns an error message string if rate limited, or null if allowed.
 *
 * Limits (configurable via IntegrationConnection.metadata):
 *   - maxMessagesPerMinutePerUser: default 10
 *   - maxInvocationsPerHour: default 100 (per connection/team)
 */
async function checkSlackRateLimit(connectionId: string, userId: string): Promise<string | null> {
    try {
        const connection = await prisma.integrationConnection.findUnique({
            where: { id: connectionId },
            select: { metadata: true }
        });
        const meta =
            connection?.metadata && typeof connection.metadata === "object"
                ? (connection.metadata as Record<string, unknown>)
                : {};

        const maxPerMinutePerUser =
            typeof meta.maxMessagesPerMinutePerUser === "number"
                ? meta.maxMessagesPerMinutePerUser
                : 10;
        const maxPerHour =
            typeof meta.maxInvocationsPerHour === "number" ? meta.maxInvocationsPerHour : 100;

        const oneMinuteAgo = new Date(Date.now() - 60_000);
        const oneHourAgo = new Date(Date.now() - 3_600_000);

        // Per-user per-minute: count recent Slack runs by this userId
        const userRecentCount = await prisma.agentRun.count({
            where: {
                source: "slack",
                userId,
                createdAt: { gte: oneMinuteAgo }
            }
        });

        if (userRecentCount >= maxPerMinutePerUser) {
            return "You're sending messages too quickly. Please wait a moment before trying again.";
        }

        // Per-org per-hour: count all Slack runs in this time window
        // Use teamId prefix in threadId to scope to this org
        const teamId = (meta.teamId as string) || "";
        const threadPrefix = teamId ? `slack-${teamId}-` : "slack-";
        const orgRecentCount = await prisma.agentRun.count({
            where: {
                source: "slack",
                threadId: { startsWith: threadPrefix },
                createdAt: { gte: oneHourAgo }
            }
        });

        if (orgRecentCount >= maxPerHour) {
            return "This workspace has reached its hourly message limit. Please try again later.";
        }
    } catch (error) {
        // Rate limiting should never block processing on error
        console.warn("[Slack] Rate limit check failed:", error);
    }

    return null;
}

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
 * Convert Markdown to Slack mrkdwn format.
 * Slack uses a different syntax than standard Markdown:
 *   Markdown **bold**  -> Slack *bold*
 *   Markdown __bold__  -> Slack *bold*
 *   Markdown *italic*  -> Slack _italic_ (only single asterisk without spaces)
 *   Markdown ## Header -> Slack *Header* (bold, no heading syntax)
 *   Markdown [text](url) -> Slack <url|text>
 *   Markdown ![alt](url) -> Slack <url|alt> (images become links)
 *   Markdown > blockquote -> Slack > blockquote (same)
 *   Markdown `code` -> Slack `code` (same)
 *   Markdown ```code``` -> Slack ```code``` (same)
 */
function markdownToSlack(text: string): string {
    let result = text;

    // Preserve code blocks from being modified
    const codeBlocks: string[] = [];
    result = result.replace(/```[\s\S]*?```/g, (match) => {
        codeBlocks.push(match);
        return `\x00CB${codeBlocks.length - 1}\x00`;
    });

    // Preserve inline code
    const inlineCode: string[] = [];
    result = result.replace(/`[^`]+`/g, (match) => {
        inlineCode.push(match);
        return `\x00IC${inlineCode.length - 1}\x00`;
    });

    // Images ![alt](url) -> <url|alt>
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<$2|$1>");

    // Links [text](url) -> <url|text>
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

    // Headers: ## Header -> *Header*
    result = result.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

    // Bold+italic: ***text*** -> *_text_*
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, "*_$1_*");
    result = result.replace(/___(.+?)___/g, "*_$1_*");

    // Bold: **text** or __text__ -> *text*
    result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");
    result = result.replace(/__(.+?)__/g, "*$1*");

    // Strikethrough: ~~text~~ -> ~text~
    result = result.replace(/~~(.+?)~~/g, "~$1~");

    // Unordered list: * item -> bullet (avoid Slack bold confusion)
    result = result.replace(/^(\s*)\*\s+/gm, "$1\u2022 ");

    // Horizontal rules
    result = result.replace(/^[-*_]{3,}$/gm, "\u2500\u2500\u2500");

    // Restore inline code
    for (let i = 0; i < inlineCode.length; i++) {
        result = result.replace(`\x00IC${i}\x00`, inlineCode[i]);
    }

    // Restore code blocks
    for (let i = 0; i < codeBlocks.length; i++) {
        result = result.replace(`\x00CB${i}\x00`, codeBlocks[i]);
    }

    return result;
}

/**
 * Parse an optional agent directive from the message text.
 * Supports:
 *   "agent:research What is X?" -> { slug: "research", text: "What is X?" }
 *   "What is X?"                -> { slug: defaultSlug, text: "What is X?" }
 *   "agent:list"                -> { slug: null, text: "", isListCommand: true }
 *   "help"                      -> { slug: null, text: "", isListCommand: true }
 */
function parseAgentDirective(
    text: string,
    defaultSlug: string
): {
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
    return { slug: defaultSlug, text: trimmed, isListCommand: false };
}

/**
 * List active agents from the database and format as a Slack message.
 * Excludes DEMO agents -- only SYSTEM and USER agents are shown.
 */
async function listActiveAgents(
    defaultSlug: string,
    organizationId?: string | null
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
        const desc = a.description ? ` -- ${a.description}` : "";
        return `  \`agent:${a.slug}\`  *${a.name}*${desc}`;
    });

    return [
        "*Available Agents*",
        "",
        ...lines,
        "",
        `_Default agent: \`${defaultSlug}\`_`,
        "_Usage: prefix your message with `agent:<slug>` to talk to a specific agent._"
    ].join("\n");
}

/**
 * Resolve Slack display identity from the agent record's metadata.
 * Falls back to the agent name when no slack-specific config is set.
 */
function resolveSlackIdentity(record: { name: string; metadata: unknown }): {
    username?: string;
    icon_emoji?: string;
    icon_url?: string;
} {
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
 * Accepts an explicit botToken for multi-tenant support; falls back to env var.
 */
async function sendSlackMessageToChannel(
    channelId: string,
    text: string,
    threadTs?: string,
    identity?: { username?: string; icon_emoji?: string; icon_url?: string },
    botToken?: string
): Promise<boolean> {
    const token = botToken || process.env.SLACK_BOT_TOKEN;

    if (!token) {
        console.error("[Slack] No bot token available (neither passed nor in env)");
        return false;
    }

    try {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
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

/**
 * Slack limits chat.postMessage text to ~4000 chars. If the response
 * exceeds this, split into multiple messages at paragraph boundaries.
 */
const SLACK_MAX_TEXT_LENGTH = 3900;

async function sendSlackMessageSafe(
    channelId: string,
    text: string,
    threadTs?: string,
    identity?: { username?: string; icon_emoji?: string; icon_url?: string },
    botToken?: string
): Promise<boolean> {
    if (text.length <= SLACK_MAX_TEXT_LENGTH) {
        return sendSlackMessageToChannel(channelId, text, threadTs, identity, botToken);
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > SLACK_MAX_TEXT_LENGTH) {
        let splitIdx = remaining.lastIndexOf("\n\n", SLACK_MAX_TEXT_LENGTH);
        if (splitIdx < SLACK_MAX_TEXT_LENGTH * 0.3) {
            splitIdx = remaining.lastIndexOf("\n", SLACK_MAX_TEXT_LENGTH);
        }
        if (splitIdx < SLACK_MAX_TEXT_LENGTH * 0.3) {
            splitIdx = SLACK_MAX_TEXT_LENGTH;
        }
        chunks.push(remaining.slice(0, splitIdx).trimEnd());
        remaining = remaining.slice(splitIdx).trimStart();
    }
    if (remaining) chunks.push(remaining);

    let success = true;
    for (const chunk of chunks) {
        const ok = await sendSlackMessageToChannel(channelId, chunk, threadTs, identity, botToken);
        if (!ok) success = false;
    }
    return success;
}

/**
 * Add a reaction to a message (e.g., :eyes: while thinking).
 * This is a human-like "I see your message" acknowledgment.
 */
async function addReaction(
    channelId: string,
    messageTs: string,
    reaction: string,
    botToken?: string
): Promise<void> {
    const token = botToken || process.env.SLACK_BOT_TOKEN;
    if (!token) return;
    try {
        await fetch("https://slack.com/api/reactions.add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                channel: channelId,
                timestamp: messageTs,
                name: reaction
            })
        });
    } catch {
        // Reactions are best-effort, ignore failures
    }
}

/**
 * Remove a reaction from a message (e.g., remove :eyes: after responding).
 */
async function removeReaction(
    channelId: string,
    messageTs: string,
    reaction: string,
    botToken?: string
): Promise<void> {
    const token = botToken || process.env.SLACK_BOT_TOKEN;
    if (!token) return;
    try {
        await fetch("https://slack.com/api/reactions.remove", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                channel: channelId,
                timestamp: messageTs,
                name: reaction
            })
        });
    } catch {
        // Reactions are best-effort, ignore failures
    }
}

/**
 * Resolve the default agent slug for Slack.
 * Priority: org metadata > env var > hardcoded fallback.
 */
async function resolveDefaultAgentSlug(organizationId: string | null): Promise<string> {
    if (organizationId) {
        try {
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: { metadata: true }
            });
            const meta = org?.metadata as Record<string, unknown> | null;
            if (meta?.slackDefaultAgentSlug && typeof meta.slackDefaultAgentSlug === "string") {
                return meta.slackDefaultAgentSlug;
            }
        } catch {
            // DB failure -- fall through to env/fallback
        }
    }
    return process.env.SLACK_DEFAULT_AGENT_SLUG || FALLBACK_AGENT_SLUG;
}

/**
 * Resolve the IntegrationConnection for Slack in a given org.
 * Used for non-event-routing scenarios where we already have an orgId.
 */
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
    installation?: SlackInstallationContext | null,
    agentSlug?: string
): Promise<ProcessMessageResult> {
    const slug = agentSlug || installation?.defaultAgentSlug || FALLBACK_AGENT_SLUG;
    const teamId = installation?.teamId || process.env.SLACK_TEAM_ID || "unknown";
    const slackThreadId = buildSlackThreadId(teamId, channelId, threadTs);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Slack] Processing message at ${new Date().toISOString()}`);
    console.log(`[Slack] User: ${userId}`);
    console.log(`[Slack] Channel: ${channelId}`);
    console.log(`[Slack] Thread: ${threadTs}`);
    console.log(`[Slack] Agent: ${slug}`);
    console.log(`[Slack] Message: ${text}`);

    // Rate limiting: check per-user messages per minute
    if (installation?.connectionId) {
        const rateLimitResult = await checkSlackRateLimit(installation.connectionId, userId);
        if (rateLimitResult) {
            return {
                text: rateLimitResult,
                identity: {}
            };
        }
    }

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
            },
            threadId: slackThreadId
        });

        agent = resolved.agent;
        record = resolved.record;
        source = resolved.source;
        agentId = record?.id || slug;

        // Block DEMO agents from being used via Slack
        if (record?.type === "DEMO") {
            console.log(`[Slack] Blocked DEMO agent "${slug}"`);
            return {
                text: `\`${slug}\` is a demo agent and isn't available in Slack. Use \`help\` to see available agents.`,
                identity: {}
            };
        }

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
    const organizationId =
        installation?.organizationId ||
        (workspaceId
            ? (
                  await prisma.workspace.findUnique({
                      where: { id: workspaceId },
                      select: { organizationId: true }
                  })
              )?.organizationId || null
            : null);
    const connection = installation?.connectionId
        ? await prisma.integrationConnection.findUnique({
              where: { id: installation.connectionId }
          })
        : await resolveSlackConnection(organizationId);

    if (organizationId) {
        // Enrich identity mapping with Slack profile data
        const slackMeta: Record<string, unknown> = {};
        if (installation?.teamId) {
            slackMeta.slackTeamId = installation.teamId;
        }

        // Lazy profile enrichment: fetch display name / avatar on first encounter
        const existingIdentity = await prisma.identityMapping.findFirst({
            where: { organizationId, slackUserId: userId },
            select: { metadata: true }
        });
        const existingMeta =
            existingIdentity?.metadata && typeof existingIdentity.metadata === "object"
                ? (existingIdentity.metadata as Record<string, unknown>)
                : {};

        const resolvedBotToken = installation?.botToken || process.env.SLACK_BOT_TOKEN;
        if (!existingMeta.slackDisplayName && resolvedBotToken) {
            try {
                const profileRes = await fetch(
                    "https://slack.com/api/users.info?" + new URLSearchParams({ user: userId }),
                    {
                        headers: { Authorization: `Bearer ${resolvedBotToken}` }
                    }
                );
                const profileData = (await profileRes.json()) as {
                    ok: boolean;
                    user?: {
                        profile?: { display_name?: string; real_name?: string; image_48?: string };
                    };
                };
                if (profileData.ok && profileData.user?.profile) {
                    const p = profileData.user.profile;
                    slackMeta.slackDisplayName = p.display_name || p.real_name || null;
                    slackMeta.slackAvatarUrl = p.image_48 || null;
                }
            } catch {
                // Non-critical, continue without profile
            }
        }

        await resolveIdentity({
            organizationId,
            slackUserId: userId,
            metadata: Object.keys(slackMeta).length > 0 ? slackMeta : undefined
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

    // Record trigger event for unified triggers dashboard
    try {
        await createTriggerEventRecord({
            agentId,
            workspaceId: record?.workspaceId || null,
            runId: run.runId,
            sourceType: "slack",
            triggerType: "event",
            entityType: "agent",
            eventName: threadTs === messageTs ? "slack.message" : "slack.app_mention",
            payload: { text, channel: channelId, user: userId },
            metadata: { channelId, userId, threadTs, messageTs }
        });
    } catch (e) {
        console.warn("[Slack] Failed to record trigger event:", e);
    }

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
            text: markdownToSlack(response.text || "I'm sorry, I couldn't generate a response."),
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

        // Deduplicate: Slack may retry events (DB-backed, cross-process safe)
        if (await isDuplicateSlackEvent(payload.event_id)) {
            console.log(`[Slack] Duplicate event ${payload.event_id}, ignoring`);
            return NextResponse.json({ ok: true });
        }

        // Resolve the Slack installation from team_id (multi-tenant routing)
        const installation = await resolveSlackInstallation(payload.team_id);

        if (!installation) {
            console.warn(`[Slack] No installation found for team_id=${payload.team_id}`);
            return NextResponse.json({ ok: true });
        }

        // Resolve bot user ID for loop prevention (per-installation)
        const botUserId = getBotUserIdForInstallation(installation);

        // Ignore messages from the bot itself (covers both bot_message subtype
        // and cases where the bot's user ID matches the event sender)
        if ("subtype" in event && event.subtype === "bot_message") {
            return NextResponse.json({ ok: true });
        }
        if ("user" in event && event.user && event.user === botUserId) {
            return NextResponse.json({ ok: true });
        }

        // Resolve org-level default agent slug from installation context
        const defaultAgentSlug = await resolveDefaultAgentSlug(installation.organizationId);

        // Handle app_mention events (when someone @mentions the bot)
        if (event.type === "app_mention") {
            const mentionEvent = event as SlackAppMentionEvent;
            const cleanText = stripBotMention(mentionEvent.text);

            if (!cleanText) {
                console.log("[Slack] Empty message after stripping mention, ignoring");
                return NextResponse.json({ ok: true });
            }

            // Parse agent directive (e.g. "agent:research What is X?" or "help")
            const directive = parseAgentDirective(cleanText, defaultAgentSlug);

            // Process asynchronously to respond within 3 seconds
            setImmediate(async () => {
                const threadTs = mentionEvent.thread_ts || mentionEvent.ts;
                const token = installation.botToken;

                // Handle help / agent:list command
                if (directive.isListCommand) {
                    const helpText = await listActiveAgents(
                        defaultAgentSlug,
                        installation.organizationId
                    );
                    await sendSlackMessageSafe(
                        mentionEvent.channel,
                        helpText,
                        threadTs,
                        undefined,
                        token
                    );
                    return;
                }

                // Show "thinking" reaction while processing
                await addReaction(mentionEvent.channel, mentionEvent.ts, "eyes", token);

                try {
                    const result = await processMessage(
                        directive.text,
                        mentionEvent.user,
                        mentionEvent.channel,
                        threadTs,
                        mentionEvent.ts,
                        installation,
                        directive.slug || undefined
                    );

                    await sendSlackMessageSafe(
                        mentionEvent.channel,
                        result.text,
                        threadTs,
                        result.identity,
                        token
                    );
                } finally {
                    // Always remove thinking reaction, even on error
                    await removeReaction(mentionEvent.channel, mentionEvent.ts, "eyes", token);
                }
            });

            return NextResponse.json({ ok: true });
        }

        if (event.type === "reaction_added") {
            const reactionEvent = event as SlackReactionEvent;

            setImmediate(async () => {
                if (installation.organizationId) {
                    await resolveIdentity({
                        organizationId: installation.organizationId,
                        slackUserId: reactionEvent.user,
                        metadata: installation.teamId
                            ? { slackTeamId: installation.teamId }
                            : undefined
                    });

                    await appendChatReaction({
                        organizationId: installation.organizationId,
                        workspaceId: null,
                        integrationConnectionId: installation.connectionId,
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

        // Handle message events (DMs + thread replies in channels)
        if (event.type === "message") {
            const messageEvent = event as SlackMessageEvent;

            if (messageEvent.subtype === "message_changed") {
                setImmediate(async () => {
                    const changedMessage = messageEvent.message;
                    const messageTs = changedMessage?.ts || messageEvent.ts;

                    if (installation.organizationId && messageTs) {
                        await upsertChatMessage({
                            organizationId: installation.organizationId,
                            workspaceId: null,
                            integrationConnectionId: installation.connectionId,
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
                    const messageTs = messageEvent.deleted_ts || messageEvent.ts;

                    if (installation.organizationId && messageTs) {
                        await upsertChatMessage({
                            organizationId: installation.organizationId,
                            workspaceId: null,
                            integrationConnectionId: installation.connectionId,
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

            // Skip messages with no text (file uploads, image-only, etc.)
            if (!messageEvent.text?.trim()) {
                return NextResponse.json({ ok: true });
            }

            // Determine if this message should get a response:
            // 1. DMs always get a response
            // 2. Channel thread replies get a response if the bot participated in that thread
            const isDM = "channel_type" in event && event.channel_type === "im";
            const isActiveThreadReply =
                !isDM &&
                messageEvent.thread_ts &&
                (await isThreadActive(
                    installation.teamId,
                    messageEvent.channel,
                    messageEvent.thread_ts
                ));

            if (isDM || isActiveThreadReply) {
                const directive = parseAgentDirective(messageEvent.text, defaultAgentSlug);

                setImmediate(async () => {
                    const threadTs = messageEvent.thread_ts || messageEvent.ts;
                    const token = installation.botToken;

                    // Handle help / agent:list command
                    if (directive.isListCommand) {
                        const helpText = await listActiveAgents(
                            defaultAgentSlug,
                            installation.organizationId
                        );
                        await sendSlackMessageSafe(
                            messageEvent.channel,
                            helpText,
                            threadTs,
                            undefined,
                            token
                        );
                        return;
                    }

                    // Show "thinking" reaction while processing
                    await addReaction(messageEvent.channel, messageEvent.ts, "eyes", token);

                    try {
                        const result = await processMessage(
                            directive.text,
                            messageEvent.user,
                            messageEvent.channel,
                            threadTs,
                            messageEvent.ts,
                            installation,
                            directive.slug || undefined
                        );

                        await sendSlackMessageSafe(
                            messageEvent.channel,
                            result.text,
                            threadTs,
                            result.identity,
                            token
                        );
                    } finally {
                        // Always remove thinking reaction, even on error
                        await removeReaction(messageEvent.channel, messageEvent.ts, "eyes", token);
                    }
                });

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
    const hasClientId = !!process.env.SLACK_CLIENT_ID;
    const hasBotToken = !!process.env.SLACK_BOT_TOKEN;

    return NextResponse.json({
        status: "Slack integration active",
        configuration: {
            signingSecretConfigured: hasSigningSecret,
            oauthConfigured: hasClientId,
            legacyBotTokenConfigured: hasBotToken
        },
        setup: {
            step1: "Create a Slack App at https://api.slack.com/apps",
            step2: "Enable Event Subscriptions and set Request URL to this endpoint",
            step3: "Subscribe to bot events: app_mention, message.im, message.channels",
            step4: "Install app to workspace and copy Bot Token",
            step5: "Add SLACK_SIGNING_SECRET and SLACK_BOT_TOKEN to .env",
            requiredScopes: [
                "app_mentions:read",
                "chat:write",
                "chat:write.customize",
                "reactions:write",
                "im:history",
                "im:read",
                "im:write",
                "channels:history",
                "channels:read"
            ],
            features: [
                "Thread auto-reply: bot responds to thread follow-ups without @mention",
                "Thinking indicator: :eyes: reaction while processing",
                "Multi-agent routing: prefix with agent:<slug> to pick an agent",
                "Per-agent identity: each agent has its own display name and icon",
                "Conversation memory: context persists within each Slack thread"
            ]
        }
    });
}
