/**
 * Channel Routing - Unified agent routing for all channels
 *
 * Handles:
 * - Default agent per channel (via env vars)
 * - Keyword-based routing (e.g., "James: help me")
 * - Session-based routing (remembers agent per conversation)
 * - Command-based switching (e.g., "/agent james")
 */

import type { ChannelType, IncomingMessage } from "./types";

/**
 * Routing result
 */
export interface RoutingResult {
    /** Agent slug to use */
    agentSlug: string;
    /** Actual message content (may be modified) */
    messageText: string;
    /** Whether this was a routing command */
    isCommand: boolean;
    /** If command, the new agent to switch to */
    switchTo?: string;
    /** Source of the routing decision */
    source: "default" | "keyword" | "session" | "command";
}

/**
 * Routing configuration
 */
export interface RoutingConfig {
    /** Default agent slug for this channel */
    defaultAgentSlug: string;
    /** Current session agent (if any) */
    sessionAgentSlug?: string;
    /** Available agent slugs for validation */
    availableAgents?: string[];
}

/**
 * Parse incoming message for routing instructions
 */
export function parseRouting(message: IncomingMessage, config: RoutingConfig): RoutingResult {
    const text = message.text.trim();

    // Check for /agent command
    const agentCommandMatch = text.match(/^\/agent\s+(\w+)/i);
    if (agentCommandMatch) {
        const newAgentSlug = agentCommandMatch[1].toLowerCase();
        return {
            agentSlug: newAgentSlug,
            messageText: text,
            isCommand: true,
            switchTo: newAgentSlug,
            source: "command"
        };
    }

    // Check for keyword-based routing (e.g., "James: help me")
    const keywordMatch = text.match(/^(\w+):\s*([\s\S]+)/);
    if (keywordMatch) {
        const agentName = keywordMatch[1].toLowerCase();
        const actualMessage = keywordMatch[2].trim();

        // Validate agent if we have a list
        if (!config.availableAgents || config.availableAgents.includes(agentName)) {
            return {
                agentSlug: agentName,
                messageText: actualMessage,
                isCommand: false,
                source: "keyword"
            };
        }
    }

    // Use session agent if available
    if (config.sessionAgentSlug) {
        return {
            agentSlug: config.sessionAgentSlug,
            messageText: text,
            isCommand: false,
            source: "session"
        };
    }

    // Use default agent
    return {
        agentSlug: config.defaultAgentSlug,
        messageText: text,
        isCommand: false,
        source: "default"
    };
}

/**
 * Get default agent slug for a channel from environment
 */
export function getDefaultAgentSlug(channel: ChannelType): string {
    switch (channel) {
        case "whatsapp":
            return process.env.WHATSAPP_DEFAULT_AGENT_SLUG || "mcp-agent";
        case "telegram":
            return process.env.TELEGRAM_DEFAULT_AGENT_SLUG || "mcp-agent";
        case "voice":
            return process.env.VOICE_DEFAULT_AGENT_SLUG || "mcp-agent";
        default:
            return "mcp-agent";
    }
}

/**
 * Format response for agent switch command
 */
export function formatAgentSwitchResponse(agentSlug: string): string {
    return `Switched to agent: ${agentSlug}. How can I help you?`;
}

/**
 * Check if a message is a system command
 */
export function isSystemCommand(text: string): boolean {
    const commands = ["/agent", "/help", "/status", "/switch"];
    const lowerText = text.toLowerCase().trim();
    return commands.some((cmd) => lowerText.startsWith(cmd));
}

/**
 * Handle system commands
 */
export function handleSystemCommand(
    text: string,
    currentAgentSlug: string
): { response: string; newAgentSlug?: string } | null {
    const lowerText = text.toLowerCase().trim();

    // /help command
    if (lowerText === "/help") {
        return {
            response: `Available commands:
• /agent <name> - Switch to a different agent
• /status - Show current agent
• /help - Show this help

You can also use "AgentName: message" format to send a single message to a specific agent.`
        };
    }

    // /status command
    if (lowerText === "/status") {
        return {
            response: `Current agent: ${currentAgentSlug}`
        };
    }

    // /agent command
    const agentMatch = lowerText.match(/^\/agent\s+(\w+)/);
    if (agentMatch) {
        const newAgent = agentMatch[1];
        return {
            response: formatAgentSwitchResponse(newAgent),
            newAgentSlug: newAgent
        };
    }

    return null;
}

/**
 * List of commonly available agents (for help text)
 */
export const COMMON_AGENTS = [
    { slug: "mcp-agent", description: "General assistant with MCP tools" },
    { slug: "assistant", description: "General-purpose assistant" },
    { slug: "research", description: "Research and analysis" },
    { slug: "james", description: "Custom agent (if configured)" },
    { slug: "grace", description: "Custom agent (if configured)" }
];
