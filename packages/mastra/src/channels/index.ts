/**
 * Channel System - Multi-channel messaging for Mastra agents
 *
 * Supports:
 * - WhatsApp via Baileys (WhatsApp Web)
 * - Telegram via grammy
 * - Voice calls via Twilio
 */

// Types
export * from "./types";

// Registry
export { channelRegistry, getChannel, initializeChannels, shutdownChannels } from "./registry";

// Routing
export {
    parseRouting,
    getDefaultAgentSlug,
    formatAgentSwitchResponse,
    isSystemCommand,
    handleSystemCommand,
    COMMON_AGENTS,
    type RoutingResult,
    type RoutingConfig
} from "./routing";

// Channel implementations
export { WhatsAppClient } from "./whatsapp/client";
export { TelegramClient } from "./telegram/client";
export { TwilioVoiceClient } from "./voice/twilio";
