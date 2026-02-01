/**
 * WhatsApp Service - Singleton wrapper for WhatsApp client
 *
 * This module manages the WhatsApp client lifecycle.
 * The client is lazily initialized when first needed.
 */

import { WhatsAppClient, type WhatsAppConfig, type MessageHandler } from "@repo/mastra/channels";
import { agentResolver } from "@repo/mastra";
import { prisma } from "@repo/database";

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
 * Default message handler - routes messages to agents
 */
const messageHandler: MessageHandler = async (message, agent) => {
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
            const { agent: targetAgent } = await agentResolver.resolve({ slug: agentName });
            const response = await targetAgent.generate(actualMessage, { maxSteps: 5 });
            return response.text || "I couldn't process that request.";
        } catch {
            // Agent not found, use default
            console.log(`[WhatsApp] Agent "${agentName}" not found, using session agent`);
        }
    }

    // Use session agent or provided agent
    const targetAgent =
        session.agentSlug !== getConfig().defaultAgentSlug
            ? (await agentResolver.resolve({ slug: session.agentSlug })).agent
            : agent;

    const response = await targetAgent.generate(message.text, { maxSteps: 5 });
    return response.text || "I couldn't process that request.";
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
