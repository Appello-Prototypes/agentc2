/**
 * Voice Service - Singleton wrapper for Twilio Voice client
 *
 * This module manages the Twilio voice client lifecycle.
 */

import { TwilioVoiceClient, type VoiceConfig, type MessageHandler } from "@repo/mastra/channels";
import { agentResolver } from "@repo/mastra";

let voiceService: TwilioVoiceClient | null = null;
let initialized = false;

/**
 * Get configuration from environment
 */
function getConfig(): VoiceConfig {
    return {
        enabled: process.env.TWILIO_ENABLED === "true",
        defaultAgentSlug: process.env.VOICE_DEFAULT_AGENT_SLUG || "mcp-agent",
        accountSid: process.env.TWILIO_ACCOUNT_SID || "",
        authToken: process.env.TWILIO_AUTH_TOKEN || "",
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
        webhookUrl: process.env.VOICE_WEBHOOK_URL,
        ttsProvider: (process.env.VOICE_TTS_PROVIDER as VoiceConfig["ttsProvider"]) || "twilio",
        elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID
    };
}

/**
 * Default message handler - routes voice input to agents
 */
const messageHandler: MessageHandler = async (message, agent) => {
    console.log(`[Voice] Handling speech from ${message.from}: "${message.text}"`);

    const response = await agent.generate(message.text, { maxSteps: 5 });
    return response.text || "I'm sorry, I couldn't understand that.";
};

/**
 * Check if service is initialized
 */
export function isVoiceInitialized(): boolean {
    return initialized;
}

/**
 * Get or create voice service
 */
export async function getVoiceService(): Promise<TwilioVoiceClient> {
    if (!voiceService) {
        const config = getConfig();
        voiceService = new TwilioVoiceClient(config);
        voiceService.onMessage(messageHandler);

        // Initialize if enabled
        if (config.enabled && !initialized) {
            initialized = true;
            try {
                await voiceService.initialize();
            } catch (error) {
                console.error("[Voice] Initialization failed:", error);
                initialized = false;
                throw error;
            }
        }
    }

    return voiceService;
}

/**
 * Shutdown voice service
 */
export async function shutdownVoiceService(): Promise<void> {
    if (voiceService) {
        await voiceService.shutdown();
        voiceService = null;
        initialized = false;
    }
}
