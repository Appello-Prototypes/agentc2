/**
 * Channel Registry - Manages all channel handlers
 */

import type {
    ChannelType,
    ChannelHandler,
    ChannelsConfig,
    OutgoingMessage,
    SendResult,
    MessageHandler
} from "./types";

/**
 * Registry of all channel handlers
 */
class ChannelRegistry {
    private handlers: Map<ChannelType, ChannelHandler> = new Map();
    private messageHandler: MessageHandler | null = null;

    /**
     * Register a channel handler
     */
    register(handler: ChannelHandler): void {
        this.handlers.set(handler.type, handler);
    }

    /**
     * Get a channel handler by type
     */
    get(type: ChannelType): ChannelHandler | undefined {
        return this.handlers.get(type);
    }

    /**
     * Get all registered channel types
     */
    getTypes(): ChannelType[] {
        return Array.from(this.handlers.keys());
    }

    /**
     * Check if a channel is registered
     */
    has(type: ChannelType): boolean {
        return this.handlers.has(type);
    }

    /**
     * Set the global message handler for all channels
     */
    setMessageHandler(handler: MessageHandler): void {
        this.messageHandler = handler;
        // Apply to all registered handlers
        for (const channelHandler of this.handlers.values()) {
            channelHandler.onMessage(handler);
        }
    }

    /**
     * Get the global message handler
     */
    getMessageHandler(): MessageHandler | null {
        return this.messageHandler;
    }

    /**
     * Initialize all registered channels
     */
    async initializeAll(): Promise<void> {
        const promises = Array.from(this.handlers.values()).map((handler) => handler.initialize());
        await Promise.all(promises);
    }

    /**
     * Shutdown all registered channels
     */
    async shutdownAll(): Promise<void> {
        const promises = Array.from(this.handlers.values()).map((handler) => handler.shutdown());
        await Promise.all(promises);
    }

    /**
     * Send a message via the appropriate channel
     */
    async send(message: OutgoingMessage): Promise<SendResult> {
        const handler = this.get(message.channel);
        if (!handler) {
            return {
                success: false,
                error: `Channel ${message.channel} not registered`
            };
        }
        return handler.send(message);
    }

    /**
     * Get status of all channels
     */
    getStatuses(): Record<ChannelType, string> {
        const statuses: Partial<Record<ChannelType, string>> = {};
        for (const [type, handler] of this.handlers.entries()) {
            statuses[type] = handler.getStatus();
        }
        return statuses as Record<ChannelType, string>;
    }
}

/**
 * Global channel registry instance
 */
export const channelRegistry = new ChannelRegistry();

/**
 * Get a channel handler by type
 */
export function getChannel(type: ChannelType): ChannelHandler | undefined {
    return channelRegistry.get(type);
}

/**
 * Initialize channels based on configuration
 */
export async function initializeChannels(config: ChannelsConfig): Promise<void> {
    // Import and register channels based on config
    if (config.whatsapp?.enabled) {
        const { WhatsAppClient } = await import("./whatsapp/client");
        const client = new WhatsAppClient(config.whatsapp);
        channelRegistry.register(client);
    }

    if (config.telegram?.enabled) {
        const { TelegramClient } = await import("./telegram/client");
        const client = new TelegramClient(config.telegram);
        channelRegistry.register(client);
    }

    if (config.voice?.enabled) {
        const { TwilioVoiceClient } = await import("./voice/twilio");
        const client = new TwilioVoiceClient(config.voice);
        channelRegistry.register(client);
    }

    // Initialize all registered channels
    await channelRegistry.initializeAll();
}

/**
 * Shutdown all channels
 */
export async function shutdownChannels(): Promise<void> {
    await channelRegistry.shutdownAll();
}
