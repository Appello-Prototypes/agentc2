/**
 * WhatsApp Service - Singleton wrapper for WhatsApp client
 *
 * This module manages the WhatsApp client lifecycle.
 * The client is lazily initialized when first needed.
 * Credentials are resolved from the database (per-org) with env-var fallback.
 *
 * Supports:
 * - Conversation memory (Mastra) per WhatsApp chat
 * - Instance channel bindings for routing
 * - Agent routing cascade: explicit > instance binding > session > org default > env > fallback
 * - Help/list commands to discover available agents
 * - Per-agent identity (agent name prefix on responses)
 * - Activity feed recording
 */

import { WhatsAppClient, type WhatsAppConfig, type MessageHandler } from "@repo/agentc2/channels";
import { agentResolver, resolveModelOverride } from "@repo/agentc2/agents";
import { recordActivity, inputPreview } from "@repo/agentc2/activity/service";
import { prisma } from "@repo/database";
import { startRun, extractTokenUsage, extractToolCalls } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";
import { resolveChannelCredentials } from "@/lib/channel-credentials";
import { encryptCredentials } from "@/lib/credential-crypto";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { lookupChannelBinding, isUserAllowed, type InstanceContext } from "@/lib/agent-instances";

const FALLBACK_AGENT_SLUG = "bigjim2-appello";

let whatsappService: WhatsAppClient | null = null;
let initialized = false;

/**
 * Check if WhatsApp is enabled via DB IntegrationConnection or env var.
 */
export async function isWhatsAppEnabled(organizationId?: string): Promise<boolean> {
    if (process.env.WHATSAPP_ENABLED === "true") return true;

    try {
        const where: Record<string, unknown> = {
            provider: { key: "whatsapp-web" },
            isActive: true
        };
        if (organizationId) where.organizationId = organizationId;

        const connection = await prisma.integrationConnection.findFirst({
            where,
            select: { id: true }
        });
        return !!connection;
    } catch {
        return false;
    }
}

/**
 * Get configuration, resolving credentials from DB then env fallback.
 */
async function getConfig(organizationId?: string): Promise<WhatsAppConfig> {
    const { credentials } = await resolveChannelCredentials("whatsapp-web", organizationId);
    const allowlistStr = credentials.WHATSAPP_ALLOWLIST || process.env.WHATSAPP_ALLOWLIST || "";
    const allowlist = allowlistStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const enabled = await isWhatsAppEnabled(organizationId);

    return {
        enabled,
        defaultAgentSlug:
            credentials.WHATSAPP_DEFAULT_AGENT_SLUG ||
            process.env.WHATSAPP_DEFAULT_AGENT_SLUG ||
            FALLBACK_AGENT_SLUG,
        allowlist: allowlist.length > 0 ? allowlist : undefined,
        selfChatMode:
            credentials.WHATSAPP_SELF_CHAT_MODE === "true" ||
            process.env.WHATSAPP_SELF_CHAT_MODE === "true",
        sessionPath:
            credentials.WHATSAPP_SESSION_PATH ||
            process.env.WHATSAPP_SESSION_PATH ||
            "./.whatsapp-session"
    };
}

/**
 * Resolve org ID from WhatsApp IntegrationConnection
 */
async function resolveOrganizationId(): Promise<string | undefined> {
    const connection = await prisma.integrationConnection.findFirst({
        where: { provider: { key: "whatsapp-web" }, isActive: true },
        select: { organizationId: true }
    });
    return connection?.organizationId ?? undefined;
}

/**
 * List active agents and format as a WhatsApp-friendly message.
 */
async function listActiveAgents(defaultSlug: string, organizationId?: string): Promise<string> {
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
        "*Available Agents*",
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
 * Default message handler - routes messages to agents with full Slack-parity features.
 */
const messageHandler: MessageHandler = async (message) => {
    console.log(
        `[WhatsApp] Handling message from ${message.from} (${message.text?.length || 0} chars)`
    );

    const channelOrgId = await resolveOrganizationId();
    const config = await getConfig(channelOrgId);
    const channelId = message.from;

    // Get or create session
    let session = await prisma.channelSession.findUnique({
        where: { channel_channelId: { channel: "whatsapp", channelId } }
    });

    if (!session) {
        const defaultWs = channelOrgId
            ? await prisma.workspace.findFirst({
                  where: { organizationId: channelOrgId, isDefault: true },
                  select: { id: true }
              })
            : null;
        session = await prisma.channelSession.create({
            data: {
                channel: "whatsapp",
                channelId,
                agentSlug: config.defaultAgentSlug,
                organizationId: channelOrgId || "",
                workspaceId: defaultWs?.id || "",
                metadata: {
                    isGroup: message.isGroup,
                    groupId: message.groupId
                }
            }
        });
    } else {
        await prisma.channelSession.update({
            where: { id: session.id },
            data: { lastActive: new Date() }
        });
    }

    const text = message.text.trim();

    // Handle help / list commands
    if (/^\/?(help|agents|agent:list)$/i.test(text)) {
        return await listActiveAgents(config.defaultAgentSlug, channelOrgId);
    }

    // Handle status command
    if (/^\/?status$/i.test(text)) {
        return `Current agent: ${session.agentSlug}`;
    }

    // Handle agent switching command (/agent slug)
    const agentMatch = text.match(/^\/agent\s+([a-z0-9_-]+)/i);
    if (agentMatch) {
        const newAgentSlug = agentMatch[1].toLowerCase();
        await prisma.channelSession.update({
            where: { id: session.id },
            data: { agentSlug: newAgentSlug }
        });
        return `Switched to agent: ${newAgentSlug}. How can I help you?`;
    }

    // Look up instance channel binding for this WhatsApp number
    let instanceBinding: InstanceContext | null = null;
    try {
        instanceBinding = await lookupChannelBinding("whatsapp", channelId);
    } catch (e) {
        console.warn("[WhatsApp] Failed to look up channel binding:", e);
    }

    // Instance-level access control
    if (instanceBinding && !isUserAllowed(instanceBinding, channelId)) {
        return "You don't have access to interact with this agent instance.";
    }

    // Agent slug resolution cascade:
    // 1. Keyword-based routing (AgentName: message)
    // 2. Instance channel binding
    // 3. Session agent
    // 4. Org default
    // 5. Env default
    // 6. Hardcoded fallback
    let agentSlug = session.agentSlug || config.defaultAgentSlug;
    let messageText = text;

    const keywordMatch = text.match(/^([a-z0-9_-]+):\s*([\s\S]+)/i);
    if (keywordMatch) {
        const possibleAgent = keywordMatch[1].toLowerCase();
        const possibleMessage = keywordMatch[2].trim();
        try {
            const agentExists = await prisma.agent.findFirst({
                where: {
                    slug: possibleAgent,
                    isActive: true,
                    ...(channelOrgId ? { workspace: { organizationId: channelOrgId } } : {})
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

    if (instanceBinding) {
        agentSlug = instanceBinding.agentSlug;
    }

    // Build thread/memory IDs
    const whatsappThreadId = `whatsapp-${channelId}`;
    const orgPrefix = channelOrgId ? `${channelOrgId}:` : "";
    const memoryThread = instanceBinding
        ? `${orgPrefix}${instanceBinding.memoryNamespace}-${channelId}`
        : `${orgPrefix}${whatsappThreadId}`;
    const memoryResource = instanceBinding
        ? `${orgPrefix}${instanceBinding.memoryNamespace}`
        : `${orgPrefix}${channelId}`;

    // Build request context metadata
    const requestMetadata: Record<string, unknown> = {
        platform: "whatsapp",
        channelId,
        isGroup: message.isGroup,
        groupId: message.groupId
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

    // Model routing (pre-resolve)
    const { modelOverride: routedModelOverride } = await resolveModelOverride(
        agentSlug,
        messageText,
        { userId: channelId, organizationId: channelOrgId }
    );

    // Resolve the agent
    let agent, record, agentId: string;
    try {
        const resolved = await agentResolver.resolve({
            slug: agentSlug,
            requestContext: {
                userId: channelId,
                organizationId: channelOrgId ?? instanceBinding?.organizationId,
                metadata: requestMetadata
            },
            threadId: memoryThread,
            modelOverride: routedModelOverride
        });
        agent = resolved.agent;
        record = resolved.record;
        agentId = record?.id || agentSlug;

        if (record?.type === "DEMO") {
            return `"${agentSlug}" is a demo agent and isn't available on WhatsApp. Use /agents to see available agents.`;
        }

        console.log(`[WhatsApp] Using agent "${agentSlug}" from ${resolved.source}`);
    } catch (error) {
        console.error(`[WhatsApp] Failed to resolve agent "${agentSlug}":`, error);
        return `I couldn't find an agent called "${agentSlug}". Use /agents to see available agents.`;
    }

    // Start recording the run
    const run = await startRun({
        agentId,
        agentSlug,
        input: messageText,
        source: "whatsapp",
        userId: channelId,
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
            sourceType: "whatsapp",
            entityType: "agent",
            runId: run.runId,
            payload: { input: messageText },
            metadata: {
                userId: channelId,
                sessionId: session.id,
                source: "whatsapp",
                isGroup: message.isGroup
            }
        });
    } catch (e) {
        console.warn("[WhatsApp] Failed to record trigger event:", e);
    }

    try {
        const effectiveMaxSteps = instanceBinding?.maxStepsOverride ?? record?.maxSteps ?? 5;
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
        const responseText = response.text || "I couldn't process that request.";

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
            type: "WHATSAPP_MESSAGE_HANDLED",
            agentId,
            agentSlug,
            agentName: record?.name,
            summary: `Handled WhatsApp message from ${channelId}: ${inputPreview(messageText)}`,
            status: "success",
            source: "whatsapp",
            runId: run.runId,
            metadata: { channelId, isGroup: message.isGroup }
        });

        // Prefix with agent name for identity (like Slack's per-agent display)
        const agentName = record?.name || agentSlug;
        const prefix = `*${agentName}*\n\n`;
        return prefix + responseText;
    } catch (error) {
        await run.fail(error instanceof Error ? error : new Error(String(error)));
        console.error("[WhatsApp] Error processing message:", error);
        return "I encountered an error processing your message. Please try again.";
    }
};

/**
 * Check if service is initialized
 */
export function isWhatsAppInitialized(): boolean {
    return initialized;
}

/**
 * Upsert an IntegrationConnection when WhatsApp connects/disconnects.
 */
async function handleConnectionChange(status: "connected" | "disconnected"): Promise<void> {
    try {
        const provider = await prisma.integrationProvider.findUnique({
            where: { key: "whatsapp-web" },
            select: { id: true }
        });
        if (!provider) return;

        const existing = await prisma.integrationConnection.findFirst({
            where: { providerId: provider.id, isActive: true },
            select: { id: true, organizationId: true, credentials: true }
        });

        if (status === "connected") {
            if (existing) {
                await prisma.integrationConnection.update({
                    where: { id: existing.id },
                    data: {
                        metadata: { status: "connected", connectedAt: new Date().toISOString() }
                    }
                });
            } else {
                const org = await prisma.organization.findFirst({
                    select: { id: true }
                });
                if (!org) return;

                const encrypted = encryptCredentials({ WHATSAPP_ENABLED: "true" });
                await prisma.integrationConnection.create({
                    data: {
                        providerId: provider.id,
                        organizationId: org.id,
                        scope: "org",
                        name: "WhatsApp Web",
                        isActive: true,
                        isDefault: true,
                        ...(encrypted ? { credentials: encrypted } : {}),
                        metadata: { status: "connected", connectedAt: new Date().toISOString() }
                    }
                });
            }
            console.log("[WhatsApp] IntegrationConnection upserted (connected)");
        } else if (existing) {
            await prisma.integrationConnection.update({
                where: { id: existing.id },
                data: {
                    metadata: { status: "disconnected", disconnectedAt: new Date().toISOString() }
                }
            });
            console.log("[WhatsApp] IntegrationConnection updated (disconnected)");
        }
    } catch (error) {
        console.error("[WhatsApp] Failed to upsert IntegrationConnection:", error);
    }
}

/**
 * Get or create WhatsApp service
 */
export async function getWhatsAppService(): Promise<WhatsAppClient> {
    if (!whatsappService) {
        const config = await getConfig();
        whatsappService = new WhatsAppClient(config);
        whatsappService.onMessage(messageHandler);
        whatsappService.onConnectionChange(handleConnectionChange);

        if (config.enabled && !initialized) {
            initialized = true;
            whatsappService.initialize().catch((error) => {
                console.error("[WhatsApp] Initialization failed:", error);
                initialized = false;
            });
        }
    }

    return whatsappService;
}

/**
 * Shutdown WhatsApp service
 */
export async function shutdownWhatsAppService(): Promise<void> {
    if (whatsappService) {
        await whatsappService.shutdown();
        whatsappService = null;
        initialized = false;
    }
}
