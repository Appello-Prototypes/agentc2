/**
 * WhatsApp Service - Singleton wrapper for WhatsApp client
 *
 * This module manages the WhatsApp client lifecycle.
 * The client is lazily initialized when first needed.
 */

import { WhatsAppClient, type WhatsAppConfig, type MessageHandler } from "@repo/mastra/channels";
import { agentResolver } from "@repo/mastra";
import { prisma } from "@repo/database";
import { startRun, extractTokenUsage, extractToolCalls } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";

let whatsappService: WhatsAppClient | null = null;
let initialized = false;

/**
 * Get configuration from environment
 */
function getConfig(): WhatsAppConfig {
    const allowlistStr = process.env.WHATSAPP_ALLOWLIST || "";
    const allowlist = allowlistStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    return {
        enabled: process.env.WHATSAPP_ENABLED === "true",
        defaultAgentSlug: process.env.WHATSAPP_DEFAULT_AGENT_SLUG || "mcp-agent",
        allowlist: allowlist.length > 0 ? allowlist : undefined,
        selfChatMode: process.env.WHATSAPP_SELF_CHAT_MODE === "true",
        sessionPath: process.env.WHATSAPP_SESSION_PATH || "./.whatsapp-session"
    };
}

/**
 * Helper to execute agent and record run
 */
async function executeAgentWithRecording(
    agentSlug: string,
    input: string,
    sessionId: string,
    userId: string
): Promise<string> {
    // Resolve the agent
    const { agent, record } = await agentResolver.resolve({ slug: agentSlug });
    const agentId = record?.id || agentSlug;

    // Start recording the run
    const run = await startRun({
        agentId,
        agentSlug,
        input,
        source: "whatsapp",
        userId,
        sessionId,
        threadId: `whatsapp-${sessionId}`
    });

    try {
        const response = await agent.generate(input, { maxSteps: record?.maxSteps ?? 5 });

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
            output: response.text || "",
            modelProvider: record?.modelProvider || "unknown",
            modelName: record?.modelName || "unknown",
            promptTokens: tokens?.promptTokens,
            completionTokens: tokens?.completionTokens,
            costUsd
        });

        return response.text || "I couldn't process that request.";
    } catch (error) {
        await run.fail(error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

/**
 * Default message handler - routes messages to agents
 * Records all runs in AgentRun for full observability
 */
const messageHandler: MessageHandler = async (message) => {
    console.log(`[WhatsApp] Handling message from ${message.from}: "${message.text}"`);

    // Get or create session
    const channelId = message.from;
    let session = await prisma.channelSession.findUnique({
        where: { channel_channelId: { channel: "whatsapp", channelId } }
    });

    if (!session) {
        session = await prisma.channelSession.create({
            data: {
                channel: "whatsapp",
                channelId,
                agentSlug: getConfig().defaultAgentSlug,
                metadata: {
                    isGroup: message.isGroup,
                    groupId: message.groupId
                }
            }
        });
    } else {
        // Update last active
        await prisma.channelSession.update({
            where: { id: session.id },
            data: { lastActive: new Date() }
        });
    }

    // Check for agent switching command
    const agentMatch = message.text.match(/^\/agent\s+(\w+)/i);
    if (agentMatch) {
        const newAgentSlug = agentMatch[1].toLowerCase();
        await prisma.channelSession.update({
            where: { id: session.id },
            data: { agentSlug: newAgentSlug }
        });
        return `Switched to agent: ${newAgentSlug}`;
    }

    // Check for keyword-based routing (e.g., "James: help me")
    const keywordMatch = message.text.match(/^(\w+):\s*([\s\S]+)/);
    if (keywordMatch) {
        const agentName = keywordMatch[1].toLowerCase();
        const actualMessage = keywordMatch[2].trim();

        try {
            return await executeAgentWithRecording(
                agentName,
                actualMessage,
                session.id,
                message.from
            );
        } catch {
            // Agent not found, use default
            console.log(`[WhatsApp] Agent "${agentName}" not found, using session agent`);
        }
    }

    // Use session agent
    const agentSlug = session.agentSlug || getConfig().defaultAgentSlug;

    try {
        return await executeAgentWithRecording(agentSlug, message.text, session.id, message.from);
    } catch (error) {
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
 * Get or create WhatsApp service
 */
export async function getWhatsAppService(): Promise<WhatsAppClient> {
    if (!whatsappService) {
        const config = getConfig();
        whatsappService = new WhatsAppClient(config);
        whatsappService.onMessage(messageHandler);

        // Start initialization (don't await - QR code takes time)
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
