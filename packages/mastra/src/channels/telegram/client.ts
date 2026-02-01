/**
 * Telegram Client - Telegram Bot integration via grammy
 *
 * Uses grammy library for Telegram Bot API.
 * Requires a bot token from @BotFather.
 */

import type {
    ChannelHandler,
    ChannelStatus,
    TelegramConfig,
    OutgoingMessage,
    SendResult,
    MessageHandler,
    IncomingMessage
} from "../types";

/**
 * Telegram client using grammy
 */
export class TelegramClient implements ChannelHandler {
    readonly type = "telegram" as const;
    private _status: ChannelStatus = "disconnected";
    private config: TelegramConfig;
    private messageHandler: MessageHandler | null = null;
    private bot: unknown = null;
    private botInfo: { id: number; username: string } | null = null;

    constructor(config: TelegramConfig) {
        this.config = config;
    }

    get status(): ChannelStatus {
        return this._status;
    }

    /**
     * Initialize Telegram bot
     */
    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            console.log("[Telegram] Channel disabled, skipping initialization");
            return;
        }

        this._status = "connecting";
        console.log("[Telegram] Initializing bot...");

        try {
            // Dynamic import of grammy (optional dependency)
            const { Bot } = await import("grammy");

            this.bot = new Bot(this.config.botToken);
            const bot = this.bot as InstanceType<typeof Bot>;

            // Get bot info
            const me = await bot.api.getMe();
            this.botInfo = { id: me.id, username: me.username || "" };
            console.log(`[Telegram] Bot initialized: @${this.botInfo.username}`);

            // Handle incoming messages
            bot.on("message:text", async (ctx) => {
                if (!this.messageHandler) return;

                try {
                    const incomingMessage = this.parseContext(ctx);

                    // Import agent resolver dynamically to avoid circular deps
                    const { agentResolver } = await import("../../agents/resolver");
                    const { agent } = await agentResolver.resolve({
                        slug: this.config.defaultAgentSlug
                    });

                    const response = await this.messageHandler(incomingMessage, agent);

                    // Send response
                    await ctx.reply(response, {
                        reply_parameters: { message_id: ctx.message.message_id }
                    });
                } catch (error) {
                    console.error("[Telegram] Error handling message:", error);
                    await ctx.reply("Sorry, I encountered an error processing your message.");
                }
            });

            // Handle voice messages
            bot.on("message:voice", async (ctx) => {
                if (!this.messageHandler) return;

                try {
                    // Get voice file
                    const file = await ctx.getFile();
                    const fileUrl = `https://api.telegram.org/file/bot${this.config.botToken}/${file.file_path}`;

                    const incomingMessage: IncomingMessage = {
                        messageId: ctx.message.message_id.toString(),
                        channel: "telegram",
                        from: ctx.from?.id.toString() || "",
                        to: this.botInfo?.id.toString() || "",
                        text: "[Voice message]",
                        timestamp: new Date(ctx.message.date * 1000),
                        isGroup: ctx.chat.type !== "private",
                        groupId: ctx.chat.type !== "private" ? ctx.chat.id.toString() : undefined,
                        media: [
                            {
                                type: "voice",
                                url: fileUrl,
                                mimeType: "audio/ogg"
                            }
                        ],
                        raw: ctx
                    };

                    // Import agent resolver dynamically
                    const { agentResolver } = await import("../../agents/resolver");
                    const { agent } = await agentResolver.resolve({
                        slug: this.config.defaultAgentSlug
                    });

                    const response = await this.messageHandler(incomingMessage, agent);

                    await ctx.reply(response, {
                        reply_parameters: { message_id: ctx.message.message_id }
                    });
                } catch (error) {
                    console.error("[Telegram] Error handling voice message:", error);
                }
            });

            // Start the bot
            if (this.config.useWebhook && this.config.webhookUrl) {
                console.log(`[Telegram] Setting webhook to ${this.config.webhookUrl}`);
                await bot.api.setWebhook(this.config.webhookUrl);
            } else {
                console.log("[Telegram] Starting polling...");
                // Start polling in background (don't await)
                bot.start({
                    onStart: () => {
                        console.log("[Telegram] Polling started");
                    }
                });
            }

            this._status = "connected";
        } catch (error) {
            console.error("[Telegram] Failed to initialize:", error);
            this._status = "error";
            throw error;
        }
    }

    /**
     * Parse grammy context to IncomingMessage
     */
    private parseContext(ctx: unknown): IncomingMessage {
        const context = ctx as {
            message: {
                message_id: number;
                text: string;
                date: number;
                reply_to_message?: { message_id: number };
            };
            from?: { id: number; username?: string; first_name?: string };
            chat: { id: number; type: string };
        };

        return {
            messageId: context.message.message_id.toString(),
            channel: "telegram",
            from: context.from?.id.toString() || "",
            to: this.botInfo?.id.toString() || "",
            text: context.message.text,
            timestamp: new Date(context.message.date * 1000),
            isGroup: context.chat.type !== "private",
            groupId: context.chat.type !== "private" ? context.chat.id.toString() : undefined,
            replyToMessageId: context.message.reply_to_message?.message_id.toString(),
            raw: ctx
        };
    }

    /**
     * Shutdown Telegram bot
     */
    async shutdown(): Promise<void> {
        console.log("[Telegram] Shutting down...");
        if (this.bot) {
            const bot = this.bot as { stop: () => void };
            bot.stop();
        }
        this._status = "disconnected";
    }

    /**
     * Send a message via Telegram
     */
    async send(message: OutgoingMessage): Promise<SendResult> {
        if (this._status !== "connected" || !this.bot) {
            return {
                success: false,
                error: "Telegram bot not connected"
            };
        }

        try {
            const bot = this.bot as {
                api: {
                    sendMessage: (
                        chatId: string | number,
                        text: string,
                        options?: { reply_parameters?: { message_id: number } }
                    ) => Promise<{ message_id: number }>;
                };
            };

            const options = message.replyToMessageId
                ? { reply_parameters: { message_id: parseInt(message.replyToMessageId) } }
                : undefined;

            const result = await bot.api.sendMessage(message.to, message.text, options);

            return {
                success: true,
                messageId: result.message_id.toString(),
                timestamp: new Date()
            };
        } catch (error) {
            console.error("[Telegram] Failed to send message:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Get current connection status
     */
    getStatus(): ChannelStatus {
        return this._status;
    }

    /**
     * Get bot info
     */
    getBotInfo(): { id: number; username: string } | null {
        return this.botInfo;
    }

    /**
     * Set message handler
     */
    onMessage(handler: MessageHandler): void {
        this.messageHandler = handler;
    }

    /**
     * Handle incoming webhook update (for webhook mode)
     */
    async handleWebhookUpdate(update: unknown): Promise<void> {
        if (!this.bot) return;

        const bot = this.bot as { handleUpdate: (update: unknown) => Promise<void> };
        await bot.handleUpdate(update);
    }
}
