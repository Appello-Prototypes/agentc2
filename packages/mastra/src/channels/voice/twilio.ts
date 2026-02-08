/**
 * Twilio Voice Client - Voice call integration
 *
 * Uses Twilio Programmable Voice for inbound/outbound calls.
 * Integrates with ElevenLabs for TTS.
 */

import type {
    ChannelHandler,
    ChannelStatus,
    VoiceConfig,
    OutgoingMessage,
    SendResult,
    MessageHandler,
    IncomingMessage,
    VoiceCall,
    VoiceCallRequest
} from "../types";

/**
 * Twilio Voice client
 */
export class TwilioVoiceClient implements ChannelHandler {
    readonly type = "voice" as const;
    private _status: ChannelStatus = "disconnected";
    private config: VoiceConfig;
    private messageHandler: MessageHandler | null = null;
    private twilioClient: unknown = null;
    private activeCalls: Map<string, VoiceCall> = new Map();

    constructor(config: VoiceConfig) {
        this.config = config;
    }

    get status(): ChannelStatus {
        return this._status;
    }

    /**
     * Initialize Twilio client
     */
    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            console.log("[Voice] Channel disabled, skipping initialization");
            return;
        }

        this._status = "connecting";
        console.log("[Voice] Initializing Twilio client...");

        try {
            // Dynamic import of Twilio (optional dependency)
            const twilio = await import("twilio");

            this.twilioClient = twilio.default(this.config.accountSid, this.config.authToken);

            // Verify credentials by fetching account info
            const client = this.twilioClient as {
                api: { account: { fetch: () => Promise<{ friendlyName: string }> } };
            };
            const account = await client.api.account.fetch();
            console.log(`[Voice] Connected to Twilio account: ${account.friendlyName}`);

            this._status = "connected";
        } catch (error) {
            console.error("[Voice] Failed to initialize:", error);
            this._status = "error";
            throw error;
        }
    }

    /**
     * Shutdown Twilio client
     */
    async shutdown(): Promise<void> {
        console.log("[Voice] Shutting down...");
        // End any active calls
        for (const call of this.activeCalls.values()) {
            if (call.status === "in-progress") {
                await this.endCall(call.callId);
            }
        }
        this._status = "disconnected";
    }

    /**
     * Send a message via voice (TTS)
     * This initiates a call and speaks the message
     */
    async send(message: OutgoingMessage): Promise<SendResult> {
        const result = await this.initiateCall({
            to: message.to,
            agentSlug: message.agentSlug,
            greeting: message.text
        });

        return {
            success: !!result.callId,
            messageId: result.callId,
            error: result.status === "failed" ? "Call failed" : undefined,
            timestamp: result.startedAt
        };
    }

    /**
     * Get current connection status
     */
    getStatus(): ChannelStatus {
        return this._status;
    }

    /**
     * Set message handler
     */
    onMessage(handler: MessageHandler): void {
        this.messageHandler = handler;
    }

    /**
     * Initiate an outbound call
     */
    async initiateCall(request: VoiceCallRequest): Promise<VoiceCall> {
        if (this._status !== "connected" || !this.twilioClient) {
            throw new Error("Twilio client not connected");
        }

        console.log(`[Voice] Initiating call to ${request.to}`);

        try {
            const client = this.twilioClient as {
                calls: {
                    create: (options: {
                        from: string;
                        to: string;
                        url: string;
                        statusCallback?: string;
                        statusCallbackEvent?: string[];
                        timeout?: number;
                    }) => Promise<{ sid: string; status: string }>;
                };
            };

            // Build TwiML URL with greeting
            const twimlUrl = this.buildTwimlUrl({
                greeting: request.greeting || "Hello, this is your AI assistant.",
                mode: request.mode,
                elevenlabsAgentId: request.elevenlabsAgentId
            });

            const call = await client.calls.create({
                from: this.config.phoneNumber,
                to: request.to,
                url: twimlUrl,
                statusCallback: this.config.webhookUrl
                    ? `${this.config.webhookUrl}/status`
                    : undefined,
                statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
                timeout: request.maxDuration || 30
            });

            const voiceCall: VoiceCall = {
                callId: call.sid,
                from: this.config.phoneNumber,
                to: request.to,
                status: this.mapTwilioStatus(call.status),
                direction: "outbound",
                startedAt: new Date()
            };

            this.activeCalls.set(call.sid, voiceCall);
            return voiceCall;
        } catch (error) {
            console.error("[Voice] Failed to initiate call:", error);
            throw error;
        }
    }

    /**
     * End an active call
     */
    async endCall(callId: string): Promise<void> {
        if (!this.twilioClient) return;

        try {
            const client = this.twilioClient as {
                calls: (sid: string) => { update: (options: { status: string }) => Promise<void> };
            };

            await client.calls(callId).update({ status: "completed" });

            const call = this.activeCalls.get(callId);
            if (call) {
                call.status = "completed";
                call.endedAt = new Date();
                call.duration = Math.floor(
                    (call.endedAt.getTime() - call.startedAt.getTime()) / 1000
                );
            }
        } catch (error) {
            console.error(`[Voice] Failed to end call ${callId}:`, error);
        }
    }

    /**
     * Get call status
     */
    getCall(callId: string): VoiceCall | undefined {
        return this.activeCalls.get(callId);
    }

    /**
     * Get all active calls
     */
    getActiveCalls(): VoiceCall[] {
        return Array.from(this.activeCalls.values()).filter(
            (call) => call.status === "in-progress" || call.status === "ringing"
        );
    }

    /**
     * Handle incoming call webhook
     */
    async handleIncomingCall(
        from: string,
        to: string,
        callSid: string
    ): Promise<{ twiml: string }> {
        console.log(`[Voice] Incoming call from ${from}`);

        const voiceCall: VoiceCall = {
            callId: callSid,
            from,
            to,
            status: "ringing",
            direction: "inbound",
            startedAt: new Date()
        };

        this.activeCalls.set(callSid, voiceCall);

        // Generate greeting TwiML
        const greeting = "Hello! I'm your AI assistant. How can I help you today?";

        // Return TwiML response
        return {
            twiml: this.generateTwiml(greeting, callSid)
        };
    }

    /**
     * Handle call status update webhook
     */
    handleStatusUpdate(callSid: string, status: string): void {
        const call = this.activeCalls.get(callSid);
        if (call) {
            call.status = this.mapTwilioStatus(status);
            if (
                status === "completed" ||
                status === "failed" ||
                status === "busy" ||
                status === "no-answer"
            ) {
                call.endedAt = new Date();
                call.duration = Math.floor(
                    (call.endedAt.getTime() - call.startedAt.getTime()) / 1000
                );
            }
        }
    }

    /**
     * Handle speech input from call
     */
    async handleSpeechInput(callSid: string, speechResult: string): Promise<{ twiml: string }> {
        console.log(`[Voice] Speech input for call ${callSid}: ${speechResult}`);

        if (!this.messageHandler) {
            return {
                twiml: this.generateTwiml(
                    "I'm sorry, I can't process your request right now.",
                    callSid
                )
            };
        }

        try {
            const call = this.activeCalls.get(callSid);
            if (!call) {
                throw new Error("Call not found");
            }

            const incomingMessage: IncomingMessage = {
                messageId: `${callSid}-${Date.now()}`,
                channel: "voice",
                from: call.from,
                to: call.to,
                text: speechResult,
                timestamp: new Date(),
                isGroup: false,
                raw: { callSid, speechResult }
            };

            // Import agent resolver dynamically
            const { agentResolver } = await import("../../agents/resolver");
            const { agent } = await agentResolver.resolve({
                slug: this.config.defaultAgentSlug
            });

            const response = await this.messageHandler(incomingMessage, agent);

            return {
                twiml: this.generateTwiml(response, callSid)
            };
        } catch (error) {
            console.error("[Voice] Error handling speech input:", error);
            return {
                twiml: this.generateTwiml(
                    "I'm sorry, I encountered an error. Please try again.",
                    callSid
                )
            };
        }
    }

    /**
     * Build TwiML URL for initial call
     */
    private buildTwimlUrl(options: {
        greeting: string;
        mode?: VoiceCallRequest["mode"];
        elevenlabsAgentId?: string;
    }): string {
        // If we have a webhook URL, use it
        if (this.config.webhookUrl) {
            const params = new URLSearchParams({ greeting: options.greeting });
            if (options.mode) {
                params.set("mode", options.mode);
            }
            if (options.elevenlabsAgentId) {
                params.set("agentId", options.elevenlabsAgentId);
            }
            return `${this.config.webhookUrl}/twiml?${params.toString()}`;
        }

        // Otherwise, use a static TwiML bin or inline TwiML
        // This is a fallback - in production you'd want the webhook
        const twiml = encodeURIComponent(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${options.greeting}</Say><Gather input="speech" timeout="5" action="/voice/gather"><Say>Please speak after the tone.</Say></Gather></Response>`
        );
        return `http://twimlets.com/echo?Twiml=${twiml}`;
    }

    /**
     * Generate TwiML response for conversation
     */
    private generateTwiml(message: string, callSid: string): string {
        const gatherUrl = this.config.webhookUrl
            ? `${this.config.webhookUrl}/gather?callSid=${callSid}`
            : "";

        // Use ElevenLabs TTS if configured, otherwise Twilio's built-in
        if (this.config.ttsProvider === "elevenlabs" && this.config.elevenlabsVoiceId) {
            // For ElevenLabs, we'd generate audio and use <Play>
            // This is a placeholder - actual implementation would call ElevenLabs API
            return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">${this.escapeXml(message)}</Say>
    <Gather input="speech" timeout="5" action="${gatherUrl}">
        <Say voice="Polly.Joanna">Please continue.</Say>
    </Gather>
    <Say voice="Polly.Joanna">Goodbye!</Say>
    <Hangup/>
</Response>`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">${this.escapeXml(message)}</Say>
    <Gather input="speech" timeout="5" action="${gatherUrl}">
        <Say voice="Polly.Joanna">Please continue.</Say>
    </Gather>
    <Say voice="Polly.Joanna">Goodbye!</Say>
    <Hangup/>
</Response>`;
    }

    /**
     * Escape XML special characters
     */
    private escapeXml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    /**
     * Map Twilio status to our status
     */
    private mapTwilioStatus(status: string): VoiceCall["status"] {
        switch (status) {
            case "queued":
            case "initiated":
            case "ringing":
                return "ringing";
            case "in-progress":
                return "in-progress";
            case "completed":
                return "completed";
            case "busy":
                return "busy";
            case "no-answer":
                return "no-answer";
            case "failed":
            case "canceled":
            default:
                return "failed";
        }
    }
}
