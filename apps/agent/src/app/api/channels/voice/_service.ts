/**
 * Voice Service - Singleton wrapper for Twilio Voice client
 *
 * This module manages the Twilio voice client lifecycle.
 */

import { TwilioVoiceClient, type VoiceConfig, type MessageHandler } from "@repo/mastra/channels";
import { agentResolver } from "@repo/mastra";
import { startRun, extractTokenUsage, extractToolCalls } from "@/lib/run-recorder";
import { calculateCost } from "@/lib/cost-calculator";

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
 * Records all runs in AgentRun for full observability
 */
const messageHandler: MessageHandler = async (message, agent) => {
    console.log(`[Voice] Handling speech from ${message.from}: "${message.text}"`);

    const config = getConfig();
    const agentSlug = config.defaultAgentSlug;

    // Resolve agent to get record info
    const { record } = await agentResolver.resolve({ slug: agentSlug });
    const agentId = record?.id || agentSlug;

    // Start recording the run
    const run = await startRun({
        agentId,
        agentSlug,
        input: message.text,
        source: "voice",
        userId: message.from,
        sessionId: message.from, // Use caller ID as session
        threadId: `voice-${message.from}-${Date.now()}`
    });

    try {
        const response = await agent.generate(message.text, { maxSteps: record?.maxSteps ?? 5 });

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

        return response.text || "I'm sorry, I couldn't understand that.";
    } catch (error) {
        await run.fail(error instanceof Error ? error : new Error(String(error)));
        console.error("[Voice] Error processing message:", error);
        return "I'm sorry, I encountered an error. Please try again.";
    }
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
