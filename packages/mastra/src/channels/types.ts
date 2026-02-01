/**
 * Channel Types - Shared interfaces for messaging channels
 */

import { Agent } from "@mastra/core/agent";

/**
 * Supported channel types
 */
export type ChannelType = "whatsapp" | "telegram" | "voice";

/**
 * Channel status
 */
export type ChannelStatus = "connected" | "disconnected" | "connecting" | "error";

/**
 * Incoming message from any channel
 */
export interface IncomingMessage {
    /** Unique message ID from the channel */
    messageId: string;
    /** Channel type */
    channel: ChannelType;
    /** Sender identifier (phone number, chat ID, etc.) */
    from: string;
    /** Recipient identifier (bot's ID) */
    to: string;
    /** Message text content */
    text: string;
    /** Timestamp */
    timestamp: Date;
    /** Whether this is a group message */
    isGroup: boolean;
    /** Group ID if applicable */
    groupId?: string;
    /** Reply-to message ID if this is a reply */
    replyToMessageId?: string;
    /** Media attachments */
    media?: MessageMedia[];
    /** Channel-specific raw data */
    raw?: unknown;
}

/**
 * Media attachment
 */
export interface MessageMedia {
    type: "image" | "audio" | "video" | "document" | "voice";
    url?: string;
    data?: Buffer;
    mimeType: string;
    filename?: string;
    caption?: string;
}

/**
 * Outgoing message to any channel
 */
export interface OutgoingMessage {
    /** Channel type */
    channel: ChannelType;
    /** Recipient identifier */
    to: string;
    /** Message text content */
    text: string;
    /** Reply to specific message */
    replyToMessageId?: string;
    /** Media attachments */
    media?: MessageMedia[];
    /** Agent that sent this message */
    agentSlug?: string;
}

/**
 * Message send result
 */
export interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
    timestamp?: Date;
}

/**
 * Channel configuration base
 */
export interface ChannelConfigBase {
    enabled: boolean;
    defaultAgentSlug: string;
}

/**
 * WhatsApp channel configuration
 */
export interface WhatsAppConfig extends ChannelConfigBase {
    /** Allowlist of phone numbers that can message */
    allowlist?: string[];
    /** Use self-chat mode (personal number) */
    selfChatMode?: boolean;
    /** Session storage path */
    sessionPath?: string;
}

/**
 * Telegram channel configuration
 */
export interface TelegramConfig extends ChannelConfigBase {
    /** Bot token from @BotFather */
    botToken: string;
    /** Use webhook or polling */
    useWebhook: boolean;
    /** Webhook URL (if using webhook) */
    webhookUrl?: string;
}

/**
 * Voice channel configuration (Twilio)
 */
export interface VoiceConfig extends ChannelConfigBase {
    /** Twilio Account SID */
    accountSid: string;
    /** Twilio Auth Token */
    authToken: string;
    /** Twilio phone number */
    phoneNumber: string;
    /** Webhook URL for call events */
    webhookUrl?: string;
    /** TTS provider */
    ttsProvider?: "elevenlabs" | "openai" | "twilio";
    /** ElevenLabs voice ID */
    elevenlabsVoiceId?: string;
}

/**
 * Combined channel configuration
 */
export interface ChannelsConfig {
    whatsapp?: WhatsAppConfig;
    telegram?: TelegramConfig;
    voice?: VoiceConfig;
}

/**
 * Channel handler interface - all channels must implement this
 */
export interface ChannelHandler {
    /** Channel type */
    readonly type: ChannelType;
    /** Current status */
    readonly status: ChannelStatus;

    /** Initialize the channel */
    initialize(): Promise<void>;

    /** Shutdown the channel */
    shutdown(): Promise<void>;

    /** Send a message */
    send(message: OutgoingMessage): Promise<SendResult>;

    /** Get connection status */
    getStatus(): ChannelStatus;

    /** Set message handler callback */
    onMessage(handler: MessageHandler): void;
}

/**
 * Message handler callback
 */
export type MessageHandler = (message: IncomingMessage, agent: Agent) => Promise<string>;

/**
 * Channel session - tracks conversations
 */
export interface ChannelSession {
    id: string;
    channel: ChannelType;
    channelId: string;
    agentSlug: string;
    metadata?: Record<string, unknown>;
    lastActive: Date;
    createdAt: Date;
}

/**
 * Channel credentials storage
 */
export interface ChannelCredentials {
    id: string;
    channel: ChannelType;
    credentials: Record<string, unknown>;
    updatedAt: Date;
}

/**
 * Voice call state
 */
export interface VoiceCall {
    callId: string;
    from: string;
    to: string;
    status: "ringing" | "in-progress" | "completed" | "failed" | "busy" | "no-answer";
    direction: "inbound" | "outbound";
    startedAt: Date;
    endedAt?: Date;
    duration?: number;
    recordingUrl?: string;
}

/**
 * Voice call request
 */
export interface VoiceCallRequest {
    to: string;
    agentSlug?: string;
    greeting?: string;
    maxDuration?: number;
}
